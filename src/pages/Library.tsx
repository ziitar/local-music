import { useEffect, useState, useCallback, useRef } from "react";
import {
  playlists as playlistsApi,
  songs as songsApi,
} from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { useAuthStore } from "../stores/authStore.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select, NativeSelect } from "../components/ui/Select.tsx";
import { formatDuration } from "../lib/utils.ts";
import {
  ListMusic,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Playlist } from "../types/index.ts";

const QUALITY_OPTIONS = [
  { value: "", label: "全部音质" },
  { value: "lossless", label: "无损" },
  { value: "320k", label: "320k" },
  { value: "192k", label: "192k" },
  { value: "128k", label: "128k" },
];

export function LibraryPage() {
  const [songsList, setSongsList] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quality, setQuality] = useState("");
  const isFirstRender = useRef(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset pagination to page 1 when filters change (after initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Reset to page 1 when search or quality changes
    setPagination(prev => {
      if (prev.page !== 1) {
        return { ...prev, page: 1 };
      }
      return prev;
    });
  }, [debouncedSearch, quality]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<number | null>(null);

  const { setPlaylist, setIsPlaying, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { isAdmin } = useAuthStore();

  const isFetchingRef = useRef(false);

  const fetchSongs = useCallback(async (page: number, limit: number, search: string, q: string) => {
    // Prevent duplicate requests - skip if already fetching
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    setIsLoading(true);
    try {
      const result = await songsApi.list({
        page,
        limit,
        search,
        quality: q,
      });
      setSongsList(result.songs);
      setPagination(result.pagination);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const result = await songsApi.scan();
      alert(result.message);
      fetchSongs(pagination.page, pagination.limit, debouncedSearch, quality);
    } catch (error) {
      alert("扫描失败");
    }
    setIsScanning(false);
  }, [fetchSongs, pagination.page, pagination.limit, debouncedSearch, quality]);

  const handlePlaySong = useCallback((song: any, index: number) => {
    // If clicking the current song, toggle play/pause
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      // Otherwise, play the new song
      setPlaylist(songsList, index);
      setIsPlaying(true);
    }
  }, [currentSong, songsList, togglePlay]);

  const fetchPlaylists = useCallback(async () => {
    try {
      const data = await playlistsApi.list();
      setPlaylists(data);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  }, []);

  const handleAddClick = useCallback((song: any) => {
    setSelectedSong(song);
    fetchPlaylists();
    setIsDialogOpen(true);
  }, [fetchPlaylists]);

  const handleAddToPlaylist = useCallback(async (playlistId: number) => {
    if (!selectedSong) return;
    setAddingToPlaylist(playlistId);
    try {
      await playlistsApi.addSong(playlistId, selectedSong.id);
      setIsDialogOpen(false);
      setSelectedSong(null);
    } catch (error: any) {
      alert(error.message || "添加失败");
    } finally {
      setAddingToPlaylist(null);
    }
  }, [selectedSong, fetchPlaylists]);

  useEffect(() => {
    fetchSongs(pagination.page, pagination.limit, debouncedSearch, quality);
  }, [fetchSongs, pagination.page, debouncedSearch, quality]);

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 backdrop-blur-md bg-background/60 border-white/10 p-2 rounded-lg">
        <h1 className="text-2xl sm:text-3xl font-bold">音乐库</h1>
        {isAdmin && (
          <Button onClick={handleScan} disabled={isScanning}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
            />
            {isScanning ? "扫描中..." : "扫描音乐"}
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索歌曲、歌手、专辑..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 音质筛选 */}
        <Select
          value={quality}
          onChange={setQuality}
          options={QUALITY_OPTIONS}
          placeholder="全部音质"
          className="w-full md:w-auto"
        />
      </div>

      {isLoading
        ? <div className="text-center py-12">加载中...</div>
        : songsList.length === 0
        ? (
          <div className="text-center py-12">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无音乐</p>
            {isAdmin && (
              <Button onClick={handleScan} className="mt-4">
                扫描音乐
              </Button>
            )}
          </div>
        )
        : (
          <>
            {/* Desktop table view - hidden on mobile */}
            <div className="hidden md:block border rounded-lg overflow-x-auto backdrop-blur-md bg-background/60 border-white/10">
              <table className="w-full min-w-[600px]">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-medium">
                      #
                    </th>
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
                  {songsList.map((song, index) => (
                    <tr
                      key={song.id}
                      className={`border-t border-white/10 hover:bg-white/50 cursor-pointer ${
                        currentSong?.id === song.id ? "bg-primary/30" : ""
                      }`}
                      onClick={() => handlePlaySong(song, index)}
                    >
                      <td className="px-3 py-2 sm:py-3 text-sm text-foreground">
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
                      <td className="px-3 py-2 sm:py-3 font-medium text-sm">{song.title}</td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-foreground">
                        {song.artist}
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-foreground">
                        {song.album}
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm">
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${
                            song.quality === "lossless"
                              ? "bg-green-100 text-green-800"
                              : song.quality === "320k"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {song.quality}
                        </span>
                      </td>
                      <td className="px-3 py-2 sm:py-3 text-sm text-foreground">
                        {formatDuration(song.duration)}
                      </td>
                      <td className="px-3 py-2 sm:py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddClick(song);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view - shown on mobile only */}
            <div className="md:hidden space-y-2">
              {songsList.map((song, index) => (
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

                    {/* Add button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddClick(song);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center items-center gap-2 mt-6 backdrop-blur-sm bg-background/60 border-white/10 p-2 rounded-lg">
              <Button
                variant="default"
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page <= 1}
              >
                上一页
              </Button>
              <span className="text-sm text-foreground">
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              {/* Quick jump dropdown when more than 5 pages */}
              {pagination.totalPages > 5 && (
                <NativeSelect
                  value={pagination.page}
                  onChange={(value) =>
                    setPagination({ ...pagination, page: Number(value) })}
                  options={Array.from({ length: pagination.totalPages }, (_, i) => ({
                    value: i + 1,
                    label: `跳转到 ${i + 1}`,
                  }))}
                />
              )}
              <Button
                variant="default"
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
              >
                下一页
              </Button>
            </div>
          </>
        )}

      {/* Add to Playlist Dialog */}
      {isDialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsDialogOpen(false)}
        >
          <div
            className="bg-background rounded-lg p-6 w-full max-w-md mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">添加到播放列表</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedSong && (
              <p className="text-sm text-muted-foreground mb-4">
                歌曲:{" "}
                <span className="font-medium text-foreground">
                  {selectedSong.title}
                </span>
              </p>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {playlists.length === 0
                ? (
                  <p className="text-center text-muted-foreground py-4">
                    暂无播放列表
                  </p>
                )
                : (
                  playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      disabled={addingToPlaylist === playlist.id}
                      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-50"
                    >
                      <ListMusic className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{playlist.name}</p>
                        {playlist.description && (
                          <p className="text-sm text-muted-foreground">
                            {playlist.description}
                          </p>
                        )}
                      </div>
                      {addingToPlaylist === playlist.id && (
                        <span className="text-sm text-muted-foreground">
                          添加中...
                        </span>
                      )}
                    </button>
                  ))
                )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsDialogOpen(false)}
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
