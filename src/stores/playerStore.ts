import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song } from "../types/index.ts";

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

  setCurrentSong: (song: Song | null) => void;
  setPlaylist: (songs: Song[], startIndex?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioElement: (element: HTMLAudioElement) => void;
  setPlayMode: (mode: PlayMode) => void;
  cyclePlayMode: () => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlay: () => void;
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

      setCurrentSong: (song) => set({ currentSong: song }),
      setPlaylist: (songs, startIndex = 0) =>
        set({
          playlist: songs,
          playlistIndex: startIndex,
          currentSong: songs[startIndex] || null,
        }),
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

        set({
          playlistIndex: nextIndex,
          currentSong: playlist[nextIndex],
        });
      },

      playPrev: () => {
        const { playlist, playlistIndex, playMode } = get();
        if (playlist.length === 0) return;

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

        set({
          playlistIndex: prevIndex,
          currentSong: playlist[prevIndex],
        });
      },

      togglePlay: () => {
        const { isPlaying, audioElement } = get();
        if (audioElement) {
          if (isPlaying) {
            audioElement.pause();
          } else {
            audioElement.play();
          }
        }
        set({ isPlaying: !isPlaying });
      },
    }),
    {
      name: "player-storage",
      // Only persist volume and playMode
      partialize: (state) => ({
        volume: state.volume,
        playMode: state.playMode,
      }),
    },
  ),
);
