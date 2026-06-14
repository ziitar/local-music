import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { playlists as playlistsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { Button } from "../components/ui/Button.tsx";
import { formatDuration } from "../lib/utils.ts";
import { ArrowLeft, Music, Pause, Play, Trash2 } from "lucide-react";
import type { Playlist as PlaylistType } from "../types/index.ts";

import { API_BASE } from "../config";

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    setPlaylist: setStorePlaylist,
    setIsPlaying,
    isPlaying,
    currentSong,
    togglePlay,
  } = usePlayerStore();

  const fetchPlaylist = async () => {
    if (!id) return;
    try {
      const data = await playlistsApi.get(parseInt(id));
      setPlaylist(data);
    } catch (error) {
      console.error("Failed to fetch playlist:", error);
    }
    setIsLoading(false);
  };

  const handlePlayAll = () => {
    if (!playlist?.songs) return;
    setStorePlaylist(playlist.songs, 0);
    setIsPlaying(true);
  };

  const handlePlaySong = (song: any, index: number) => {
    if (!playlist?.songs) return;
    // If clicking the current song, toggle play/pause
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      setStorePlaylist(playlist.songs, index);
      setIsPlaying(true);
    }
  };

  const handleRemoveSong = async (songId: number) => {
    if (!id || !confirm("确定要从歌单中移除这首歌吗?")) return;
    try {
      await playlistsApi.removeSong(parseInt(id), songId);
      fetchPlaylist();
    } catch (error) {
      alert("移除失败");
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center">加载中...</div>;
  }

  if (!playlist) {
    return <div className="container mx-auto p-6 text-center">歌单不存在</div>;
  }

  // Get cover from last song's album
  const coverImage = playlist.songs && playlist.songs.length > 0
    ? playlist.songs[playlist.songs.length - 1]?.cover_image
    : null;

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <Button
        variant="ghost"
        onClick={() => window.history.back()}
        className="mb-3 sm:mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">返回</span>
      </Button>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {coverImage
            ? (
              <img
                src={API_BASE + coverImage}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            )
            : (
              <Music className="h-12 w-12 sm:h-24 sm:w-24 text-muted-foreground" />
            )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-muted-foreground mb-2">{playlist.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {playlist.songs?.length || 0} 首歌曲
          </p>
          <Button onClick={handlePlayAll} className="mt-3 sm:mt-4 w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4" />
            播放全部
          </Button>
        </div>
      </div>

      {playlist.songs && playlist.songs.length > 0
        ? (
          <>
            {/* Mobile card view - shown on mobile only */}
            <div className="md:hidden space-y-2">
              {playlist.songs.map((song, index) => (
                <div
                  key={song.id}
                  className={`p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 cursor-pointer ${
                    currentSong?.id === song.id ? "bg-primary/30" : "hover:bg-white/50"
                  }`}
                  onClick={() => handlePlaySong(song, index)}
                >
                  <div className="flex items-center gap-3">
                    {/* Play indicator / number */}
                    <div className="w-8 flex-shrink-0 text-center">
                      {currentSong?.id === song.id
                        ? (
                          isPlaying
                            ? <Pause className="h-5 w-5 fill-current" />
                            : <Play className="h-5 w-5 fill-current" />
                        )
                        : <span className="text-sm text-muted-foreground">{index + 1}</span>}
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{song.album}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          song.quality === "lossless"
                            ? "bg-green-100 text-green-800"
                            : song.quality === "320k"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {song.quality}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatDuration(song.duration)}</span>
                      </div>
                    </div>

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSong(song.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view - hidden on mobile */}
            <div className="hidden md:block border rounded-lg overflow-x-auto backdrop-blur-sm bg-background/50 border-white/10">
              <table className="w-full min-w-[600px]">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-medium">#</th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      歌曲
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      歌手
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      专辑
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      音质
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      时长
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {playlist.songs.map((song, index) => (
                    <tr
                      key={song.id}
                      className={`border-t border-white/10 hover:bg-white/10 cursor-pointer ${
                        currentSong?.id === song.id ? "bg-primary/20" : ""
                      }`}
                      onClick={() => handlePlaySong(song, index)}
                    >
                      <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                        {currentSong?.id === song.id
                          ? (
                            isPlaying
                              ? <Pause className="h-4 w-4 fill-current" />
                              : <Play className="h-4 w-4 fill-current" />
                          )
                          : (
                            index + 1
                          )}
                      </td>
                      <td className="px-3 py-2 sm:py-3 font-medium">{song.title}</td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                        {song.artist}
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                        {song.album}
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            song.quality === "lossless"
                              ? "bg-green-500/20 text-green-300"
                              : song.quality === "320k"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {song.quality}
                        </span>
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                        {formatDuration(song.duration)}
                      </td>
                      <td className="px-3 py-2 sm:py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSong(song.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
        : (
          <div className="text-center py-12">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">歌单为空</p>
          </div>
        )}
    </div>
  );
}
