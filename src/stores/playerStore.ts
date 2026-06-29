import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song } from "../types/index.ts";
import { songs as songsApi } from "../services/api.ts";

// 追踪当前正在流式播放的歌曲 ID，用于在切歌/暂停时通知后端停止 ffmpeg
let currentStreamSongId: number | null = null;

export type PlayMode = "sequential" | "random" | "repeat-one" | "repeat-all";

interface PlayerState {
  currentSong: Song | null;
  playlist: Song[];
  playlistIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  audioElement: HTMLAudioElement | null;
  playMode: PlayMode;
  selectedBitrate: string;
  // EQ & loudness
  eqEnabled: boolean;
  eqPreset: string;
  loudnessNormEnabled: boolean;

  setCurrentSong: (song: Song | null) => void;
  setPlaylist: (songs: Song[], startIndex?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioElement: (element: HTMLAudioElement) => void;
  setPlayMode: (mode: PlayMode) => void;
  setSelectedBitrate: (bitrate: string) => void;
  cyclePlayMode: () => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlay: () => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqPreset: (preset: string) => void;
  setLoudnessNormEnabled: (enabled: boolean) => void;
}

// Get initial volume from localStorage or default to 1
export const getInitialVolume = (): number => {
  try {
    const stored = localStorage.getItem("player-volume");
    if (stored !== null) {
      const vol = parseFloat(stored);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        return vol;
      }
    }
  } catch {
    // Ignore errors
  }
  return 1;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentSong: null,
      playlist: [],
      playlistIndex: -1,
      isPlaying: false,
      volume: getInitialVolume(),
      currentTime: 0,
      duration: 0,
      audioElement: null,
      playMode: "sequential",
      selectedBitrate: "",
      eqEnabled: false,
      eqPreset: "flat",
      loudnessNormEnabled: false,

      setCurrentSong: (song) => {
        // 通知后端停止旧歌的 ffmpeg 进程
        if (currentStreamSongId != null) {
          songsApi.stopStream(currentStreamSongId);
        }
        currentStreamSongId = song?.id ?? null;
        set({ currentSong: song });
      },
      setPlaylist: (songs, startIndex = 0) => {
        // 通知后端停止旧歌的 ffmpeg 进程
        if (currentStreamSongId != null) {
          songsApi.stopStream(currentStreamSongId);
        }
        const newSong = songs[startIndex] || null;
        currentStreamSongId = newSong?.id ?? null;
        set({
          playlist: songs,
          playlistIndex: startIndex,
          currentSong: newSong,
        });
      },
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (volume) => {
        const { audioElement } = get();
        if (audioElement) {
          audioElement.volume = volume;
        }
        // Persist volume to localStorage
        try {
          localStorage.setItem("player-volume", volume.toString());
        } catch {
          // Ignore errors
        }
        set({ volume });
      },
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setAudioElement: (element) => {
        const { volume } = get();
        if (element) {
          element.volume = volume;
        }
        set({ audioElement: element });
      },
      setPlayMode: (mode) => set({ playMode: mode }),
      setSelectedBitrate: (bitrate) => set({ selectedBitrate: bitrate }),

      cyclePlayMode: () => {
        const modes: PlayMode[] = [
          "sequential",
          "random",
          "repeat-all",
          "repeat-one",
        ];
        const { playMode } = get();
        const currentIndex = modes.indexOf(playMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        set({ playMode: nextMode });
      },

      playNext: () => {
        const { playlist, playlistIndex, playMode } = get();
        if (playlist.length === 0) return;

        // 通知后端停止旧歌的 ffmpeg 进程
        if (currentStreamSongId != null) {
          songsApi.stopStream(currentStreamSongId);
        }

        let nextIndex: number;

        switch (playMode) {
          case "random":
            nextIndex = Math.floor(Math.random() * playlist.length);
            break;
          case "repeat-one":
            nextIndex = playlistIndex;
            break;
          case "repeat-all":
          case "sequential":
          default:
            nextIndex = (playlistIndex + 1) % playlist.length;
            break;
        }

        const nextSong = playlist[nextIndex];
        currentStreamSongId = nextSong?.id ?? null;
        set({
          playlistIndex: nextIndex,
          currentSong: nextSong,
        });
      },

      playPrev: () => {
        const { playlist, playlistIndex, playMode } = get();
        if (playlist.length === 0) return;

        // 通知后端停止旧歌的 ffmpeg 进程
        if (currentStreamSongId != null) {
          songsApi.stopStream(currentStreamSongId);
        }

        let prevIndex: number;

        switch (playMode) {
          case "random":
            prevIndex = Math.floor(Math.random() * playlist.length);
            break;
          case "repeat-one":
            prevIndex = playlistIndex;
            break;
          default:
            prevIndex = playlistIndex <= 0
              ? playlist.length - 1
              : playlistIndex - 1;
            break;
        }

        const prevSong = playlist[prevIndex];
        currentStreamSongId = prevSong?.id ?? null;
        set({
          playlistIndex: prevIndex,
          currentSong: prevSong,
        });
      },

      togglePlay: () => {
        const { isPlaying, audioElement } = get();
        if (audioElement) {
          if (isPlaying) {
            audioElement.pause();
            // 注意：暂停时不调用 stopStream，因为恢复播放需要同一个 HTTP 流
            // ffmpeg 进程会在 pipe 缓冲区满后阻塞，不会无限占用 CPU
          } else {
            audioElement.play();
          }
        }
        set({ isPlaying: !isPlaying });
      },

      setEqEnabled: (enabled) => set({ eqEnabled: enabled }),
      setEqPreset: (preset) => set({ eqPreset: preset }),
      setLoudnessNormEnabled: (enabled) => set({ loudnessNormEnabled: enabled }),
    }),
    {
      name: "player-storage",
      // Only persist volume, playMode, and selectedBitrate
      partialize: (state) => ({
        volume: state.volume,
        playMode: state.playMode,
        selectedBitrate: state.selectedBitrate,
        eqEnabled: state.eqEnabled,
        eqPreset: state.eqPreset,
        loudnessNormEnabled: state.loudnessNormEnabled,
      }),
    },
  ),
);
