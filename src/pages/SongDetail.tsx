import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { songs as songsApi, lyrics as lyricsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { parseLrc, findActiveLine } from "../lib/lrcParser.ts";
import { useAudioAnalyser } from "../lib/useAudioAnalyser.ts";
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
    currentTime,
    audioElement,
    setCurrentTime,
  } = usePlayerStore();

  const analyser = useAudioAnalyser(audioElement);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const touchStartRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

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
    if (activeLineIndex < 0 || !lyricsContainerRef.current) return;
    const lineEl = lineRefs.current[activeLineIndex];
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex]);

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

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, width, height);

      const barCount = Math.min(bufferLength, 64);
      const barWidth = width / barCount;
      const gap = 2;

      for (let i = 0; i < barCount; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.85;
        const x = i * barWidth;
        const y = height - barHeight;

        const hue = 220 + (i / barCount) * 40;
        const lightness = 50 + (dataArray[i] / 255) * 20;

        ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
        ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);

        const gradient = ctx.createLinearGradient(x, y, x, y + 10);
        gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.6)`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(x + gap / 2, y, barWidth - gap, 10);
      }
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
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!song) {
    return <div className="min-h-screen flex items-center justify-center">歌曲不存在</div>;
  }

  return (
    <div className="min-h-screen relative">
      {song.cover_image && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${API_BASE + song.cover_image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(60px) brightness(0.3)',
            transform: 'scale(1.2)',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold truncate flex-1">{song.title}</h1>
        </div>

        <div className="flex flex-col items-center px-6 py-4">
          <div className="w-48 h-48 sm:w-64 sm:h-64 bg-muted rounded-lg flex items-center justify-center overflow-hidden shadow-2xl mb-4">
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

          <h2 className="text-xl sm:text-2xl font-bold text-center">{song.title}</h2>
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
          className="flex-1 overflow-hidden px-4 pb-24"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-in-out h-full"
            style={{
              transform: activeTab === 'visualizer' ? 'translateX(-50%)' : 'translateX(0)',
              width: '200%',
            }}
          >
            <div className="w-1/2 h-full overflow-y-auto" ref={lyricsContainerRef}>
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
                            : index < activeLineIndex
                            ? 'text-muted-foreground/60 text-base'
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

            <div className="w-1/2 h-full flex items-center justify-center">
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
          </div>
        </div>
      </div>
    </div>
  );
}
