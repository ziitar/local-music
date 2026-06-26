import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { songs as songsApi, lyrics as lyricsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { parseLrc, findActiveLine } from "../lib/lrcParser.ts";
import { audioAnalyserService } from "../services/audioAnalyser.ts";
import { createVisualizerState, drawSciFiVisualizer } from "../lib/visualizer.ts";
import { ArrowLeft, Music } from "lucide-react";
import type { Song } from "../types/index.ts";
import type { LrcLine } from "../lib/lrcParser.ts";

import { API_BASE } from "../config";

// Song detail page with lyrics and audio visualization
// Called by: src/App.tsx as route /song/:id
// Data: reads Song via songsApi.get(id), lyrics via lyricsApi.get(title, artist)
// User instruction: "当点击底部的播放组件歌曲名称，可以进入到歌曲详情...歌词来源网易云...歌词可以根据播放进度滚动显示...歌词区域能右滑显示音乐可视化区域"

type ActiveTab = 'lyrics' | 'visualizer';

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('lyrics');

  const {
    currentSong,
    currentTime,
    audioElement,
    setCurrentTime,
  } = usePlayerStore();

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(
    audioAnalyserService.getAnalyser(),
  );

  // Wait for PlayerBar to initialize the analyser, or try to init ourselves
  useEffect(() => {
    if (!analyser) {
      const id = setInterval(() => {
        // Try to initialize if not yet ready and we have an audio element
        if (audioElement && !audioAnalyserService.isReady()) {
          audioAnalyserService.init(audioElement);
        }
        const a = audioAnalyserService.getAnalyser();
        if (a) {
          setAnalyser(a);
          clearInterval(id);
        }
      }, 100);
      return () => clearInterval(id);
    }
  }, [analyser, audioElement]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visualizerStateRef = useRef(createVisualizerState());

  const touchStartRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Fetch initial song from URL param
  useEffect(() => {
    const fetchSong = async () => {
      if (!id) return;
      try {
        const data = await songsApi.get(parseInt(id));
        setSong(data);
      } catch (error) {
        console.error("Failed to fetch song:", error);
      }
      setIsLoading(false);
    };
    fetchSong();
  }, [id]);

  // Sync with player's currentSong when it changes (auto next/prev)
  useEffect(() => {
    if (currentSong) {
      setSong(currentSong);
    }
  }, [currentSong?.id]);

  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song) return;
      setIsLyricsLoading(true);
      try {
        const data = await lyricsApi.get(song.title, song.artist);
        if (data.lrc) {
          const lines = parseLrc(data.lrc);
          setLrcLines(lines);
        } else {
          setLrcLines([]);
        }
      } catch (error) {
        console.error("Failed to fetch lyrics:", error);
        setLrcLines([]);
      }
      setIsLyricsLoading(false);
    };
    fetchLyrics();
  }, [song?.id]);

  const activeLineIndex = useMemo(() => {
    return findActiveLine(lrcLines, currentTime);
  }, [lrcLines, currentTime]);

  useEffect(() => {
    if (activeTab !== 'lyrics') return;
    if (activeLineIndex < 0 || !lyricsContainerRef.current) return;
    const lineEl = lineRefs.current[activeLineIndex];
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeLineIndex, activeTab]);

  const handleLyricClick = useCallback((time: number) => {
    if (audioElement) {
      audioElement.currentTime = time;
      setCurrentTime(time);
    }
  }, [audioElement, setCurrentTime]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartYRef.current);

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > deltaY) {
      if (deltaX < 0 && activeTab === 'lyrics') {
        setActiveTab('visualizer');
      } else if (deltaX > 0 && activeTab === 'visualizer') {
        setActiveTab('lyrics');
      }
    }
  }, [activeTab]);

  // Audio visualization drawing loop
  useEffect(() => {
    if (activeTab !== 'visualizer' || !analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const waveformData = new Uint8Array(analyser.fftSize);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(waveformData);

      drawSciFiVisualizer(ctx, canvas, frequencyData, waveformData, visualizerStateRef.current);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [activeTab, analyser]);

  // Resize canvas
  useEffect(() => {
    if (activeTab !== 'visualizer') return;

    const resizeCanvas = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        canvasRef.current.width = parent.clientWidth;
        canvasRef.current.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [activeTab]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">加载中...</div>;
  }

  if (!song) {
    return <div className="h-full flex items-center justify-center">歌曲不存在</div>;
  }

  return (
    <div className="h-full overflow-hidden relative">
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold truncate flex-1 text-foreground">{song.title}</h1>
        </div>

        <div className="flex flex-col items-center px-6 py-4">
          <div className="w-36 h-36 sm:w-48 sm:h-48 bg-muted rounded-lg flex items-center justify-center overflow-hidden shadow-2xl mb-4">
            {song.cover_image
              ? (
                <img
                  src={API_BASE + song.cover_image}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              )
              : (
                <Music className="h-16 w-16 text-muted-foreground" />
              )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground">{song.title}</h2>
          <p className="text-sm text-muted-foreground text-center mt-1">{song.artist}</p>
          {song.album && song.album !== 'Unknown Album' && (
            <p className="text-xs text-muted-foreground text-center mt-1">{song.album}</p>
          )}
        </div>

        <div className="flex justify-center gap-2 px-4 mb-2">
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'lyrics'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/10 text-muted-foreground hover:bg-white/20'
            }`}
            onClick={() => setActiveTab('lyrics')}
          >
            歌词
          </button>
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'visualizer'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/10 text-muted-foreground hover:bg-white/20'
            }`}
            onClick={() => setActiveTab('visualizer')}
          >
            可视化
          </button>
        </div>

        <div
          className="flex-1 overflow-hidden px-4 pb-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeTab === 'lyrics' ? (
            <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" ref={lyricsContainerRef}>
              {isLyricsLoading
                ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">歌词加载中...</p>
                  </div>
                )
                : lrcLines.length > 0
                ? (
                  <div className="py-8 space-y-3">
                    {lrcLines.map((line, index) => (
                      <div
                        key={index}
                        ref={(el) => { lineRefs.current[index] = el; }}
                        className={`cursor-pointer px-4 py-1 rounded transition-all duration-300 text-center ${
                          index === activeLineIndex
                            ? 'text-primary text-lg font-semibold scale-105'
                            : 'text-muted-foreground text-base'
                        }`}
                        onClick={() => handleLyricClick(line.time)}
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>
                )
                : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">暂无歌词</p>
                  </div>
                )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              {analyser
                ? (
                  <canvas ref={canvasRef} className="w-full h-full" />
                )
                : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">播放音乐后显示可视化</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
