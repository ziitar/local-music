import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../../stores/playerStore.ts";
import { history, songs as songsApi } from "../../services/api.ts";
import { formatDuration } from "../../lib/utils.ts";
import {
  updateMediaSessionMetadata,
  setupMediaSessionHandlers,
  updateMediaSessionPlaybackState,
} from "../../services/mediaSession.ts";
import {
  startBackgroundAudio,
  stopBackgroundAudio,
} from "../../services/backgroundAudio.ts";
import {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../ui/Button.tsx";

const BITRATE_OPTIONS = [
  { value: "", label: "原始" },
  { value: "lossless", label: "无损" },
  { value: "320k", label: "320K" },
  { value: "192k", label: "192k" },
  { value: "128k", label: "128K" },
];

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showBitrateMenu, setShowBitrateMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const bitrateMenuRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    playMode,
    selectedBitrate,
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    audioElement,
    setAudioElement,
    cyclePlayMode,
    setSelectedBitrate,
    playNext,
    playPrev,
  } = usePlayerStore();

  // Close bitrate menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bitrateMenuRef.current && !bitrateMenuRef.current.contains(event.target as Node)) {
        setShowBitrateMenu(false);
      }
    };

    if (showBitrateMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBitrateMenu]);

  // Close volume slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeSliderRef.current && !volumeSliderRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };

    if (showVolumeSlider) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVolumeSlider]);

  // Always use database duration - transcoding doesn't change song length
  // Audio element returns Infinity for transcoded streams
  const effectiveDuration = currentSong?.duration || 0;

  useEffect(() => {
    if (audioRef.current) {
      // 同步当前音量到 audio 元素
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
    if(!audioElement){
      setAudioElement(audioRef.current);
    }
    // Set duration immediately from database
    if (currentSong.duration && currentSong.duration > 0) {
      setDuration(currentSong.duration);
    }

    const loadAndPlay = async () => {
      try {
        const url = await songsApi.streamUrl(currentSong.id, {
          isCueTrack: currentSong.is_cue_track,
          bitrate: selectedBitrate || undefined,
        });
        audioRef.current!.src = url;
        audioRef.current!.load(); // Important: load the new source

        if (isPlaying) {
          try {
            await audioRef.current!.play();
          } catch (e) {
            console.error("Play failed:", e);
            // If play fails, try without bitrate selection (fallback to original)
            if (selectedBitrate) {
              const fallbackUrl = await songsApi.streamUrl(currentSong.id, {
                isCueTrack: currentSong.is_cue_track,
              });
              audioRef.current!.src = fallbackUrl;
              audioRef.current!.load();
              try {
                await audioRef.current!.play();
              } catch (fallbackError) {
                console.error("Fallback play also failed:", fallbackError);
              }
            }
          }
        }

        try {
          await history.add(currentSong.id);
        } catch (e) {
          console.error("Failed to record history:", e);
        }
      } catch (e) {
        console.error("Failed to load stream:", e);
      }
    };

    loadAndPlay();
  }, [currentSong?.id, selectedBitrate]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(console.error);
      startBackgroundAudio();
    } else {
      audioRef.current.pause();
      stopBackgroundAudio();
    }

    // Update Media Session playback state
    updateMediaSessionPlaybackState({
      isPlaying,
      currentTime: audioRef.current.currentTime || 0,
      duration: effectiveDuration,
    });
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioRef.current?.currentTime || 0);
      // Update Media Session playback state for lock screen progress
      updateMediaSessionPlaybackState({
        isPlaying: !audioRef.current?.paused,
        currentTime: audioRef.current?.currentTime || 0,
        duration: effectiveDuration,
      });
    };

    const handleLoadedMetadata = () => {
      // Always use database duration - transcoded streams don't have proper duration
      // The audio element returns Infinity for live/transcoded streams
      if (currentSong?.duration && currentSong.duration > 0) {
        setDuration(currentSong.duration);
      } else if (
        audioRef.current?.duration &&
        isFinite(audioRef.current.duration)
      ) {
        // Fallback to audio duration only if it's a valid finite number
        setDuration(audioRef.current.duration);
      }
    };

    const handleEnded = () => {
      if (playMode === "repeat-one" && audioRef.current) {
        // For repeat-one mode, restart the current song
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      } else {
        playNext();
      }
    };

    const handleError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      console.error("Audio error:", audio.error);
      // If there's an error and we have a bitrate selected, try falling back
      if (selectedBitrate && audio.error) {
        console.log("Attempting fallback to original quality due to error");
        setSelectedBitrate("");
      }
    };

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("error", handleError);

    return () => {
      audioRef.current?.removeEventListener("timeupdate", handleTimeUpdate);
      audioRef.current?.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata,
      );
      audioRef.current?.removeEventListener("ended", handleEnded);
      audioRef.current?.removeEventListener("error", handleError);
    };
  }, [playNext, currentSong, selectedBitrate, playMode]);

  // Media Session: register action handlers
  useEffect(() => {
    setupMediaSessionHandlers({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onPreviousTrack: playPrev,
      onNextTrack: playNext,
      onSeekTo: (time) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
    });
  }, [playNext, playPrev, setIsPlaying, setCurrentTime]);

  // Media Session: update metadata when song changes
  useEffect(() => {
    if (currentSong) {
      updateMediaSessionMetadata(currentSong);
    }
  }, [currentSong?.id]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      // 确保拖动时间在有效范围内
      const clampedTime = Math.max(0, Math.min(time, effectiveDuration));
      audioRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
  };

  const toggleMute = () => {
    setVolume(volume === 0 ? 1 : 0);
  };

  if (!currentSong) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/70 border-t border-white/10 px-2 sm:px-4 py-2 sm:py-3">
      <audio ref={audioRef} preload="metadata" />

      <div className="flex items-center gap-1 sm:gap-4 max-w-screen-2xl mx-auto">
        {/* 歌曲信息 - 自适应宽度 */}
        <div className="flex-1 min-w-0 max-w-[120px] sm:max-w-[200px]">
          <p className="font-medium text-sm sm:text-base truncate">{currentSong.title}</p>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {currentSong.artist}
          </p>
        </div>

        {/* 播放控制 */}
        <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={cyclePlayMode}
            className="h-9 w-9 sm:h-10 sm:w-10"
            title={playMode}
          >
            {playMode === "random"
              ? <Shuffle className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              : playMode === "repeat-one"
              ? <Repeat1 className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              : playMode === "repeat-all"
              ? <Repeat className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              : <Repeat className="h-3.5 w-3.5 sm:h-5 sm:w-5 opacity-50" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={playPrev}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <SkipBack className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-10 w-10 sm:h-10 sm:w-10"
          >
            {isPlaying
              ? <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
              : <Play className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={playNext}
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <SkipForward className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* 进度条 - 自适应宽度 */}
        <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0 max-w-md">
          <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            value={Math.min(currentTime, effectiveDuration || 0)}
            onChange={handleSeek}
            className="flex-1 h-1 accent-primary min-w-0 self-center"
          />
          <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
            {formatDuration(effectiveDuration)}
          </span>
        </div>

        {/* Mobile progress bar - simplified */}
        <div className="flex sm:hidden items-center gap-1 flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            value={Math.min(currentTime, effectiveDuration || 0)}
            onChange={handleSeek}
            className="flex-1 h-1 accent-primary min-w-0 self-center"
          />
        </div>

        {/* 音量控制 - 移动端点击显示滑块，桌面端始终显示 */}
        <div className="relative flex items-center gap-1 flex-shrink-0" ref={volumeSliderRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              toggleMute();
            }}
            className="h-9 w-9 hidden sm:block sm:h-10 sm:w-10"
          >
            {volume === 0
              ? <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
              : <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowVolumeSlider(!showVolumeSlider);
            }}
            className="h-9 w-9 sm:hidden sm:h-10 sm:w-10"
          >
            {volume === 0
              ? <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
              : <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>

          {/* 桌面端音量滑块 - 始终显示 */}
          <div className="hidden sm:flex w-20 sm:w-24 self-center items-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-1 accent-primary self-center"
            />
          </div>

          {/* 移动端点击显示音量滑块 - 向上弹出 */}
          {showVolumeSlider && (
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-background border rounded-lg shadow-lg z-50">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-1.5 accent-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* 比特率选择器 - 自定义下拉菜单，向上弹出 */}
        <div className="relative flex-shrink-0" ref={bitrateMenuRef}>
          <button
            onClick={() => setShowBitrateMenu(!showBitrateMenu)}
            className="text-xs bg-background border rounded px-1 sm:px-2 py-1 h-8 sm:h-9 flex items-center gap-1 min-w-[60px] sm:min-w-[70px] hover:bg-muted transition-colors"
            title="Audio quality"
          >
            <span>{BITRATE_OPTIONS.find(o => o.value === selectedBitrate)?.label || "原始"}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showBitrateMenu ? "rotate-180" : ""}`} />
          </button>

          {/* 下拉菜单 - 向上弹出 */}
          {showBitrateMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-background border rounded-md shadow-lg overflow-hidden z-50">
              {BITRATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedBitrate(option.value);
                    setShowBitrateMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-muted transition-colors ${
                    selectedBitrate === option.value ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
