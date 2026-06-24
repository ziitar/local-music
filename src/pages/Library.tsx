import { useEffect, useState, useCallback, useRef } from "react";
import {
  playlists as playlistsApi,
  songs as songsApi,
} from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { useAuthStore } from "../stores/authStore.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { SongList } from "../components/SongList.tsx";
import { useDebounce } from "../hooks/useDebounce.ts";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import {
  ChevronDown,
  ListMusic,
  Music,
  Plus,
  RefreshCw,
  Search,
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
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [quality, setQuality] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<number | null>(null);

  const { setPlaylist, setIsPlaying, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { isAdmin } = useAuthStore();

  useClickOutside(qualityMenuRef, () => setShowQualityMenu(false), showQualityMenu);

  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await songsApi.list({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        quality,
      });
      setSongsList(result.songs);
      setPagination(result.pagination);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
    }
    setIsLoading(false);
  }, [pagination, debouncedSearch, quality]);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const result = await songsApi.scan();
      alert(result.message);
      fetchSongs();
    } catch (error) {
      alert("扫描失败");
    }
    setIsScanning(false);
  }, [fetchSongs]);

  const handlePlaySong = useCallback((song: any, index: number) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
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
    fetchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, debouncedSearch, quality]);

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

        {/* 音质筛选 - 自定义下拉菜单 */}
        <div className="relative w-full md:w-auto" ref={qualityMenuRef}>
          <button
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm flex items-center justify-between gap-2 hover:bg-muted transition-colors md:w-auto"
          >
            <span>{QUALITY_OPTIONS.find(o => o.value === quality)?.label || "全部音质"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showQualityMenu ? "rotate-180" : ""}`} />
          </button>

          {showQualityMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg overflow-hidden z-50">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setQuality(option.value);
                    setShowQualityMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                    quality === option.value ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading
        ? <LoadingState />
        : songsList.length === 0
        ? (
          <EmptyState
            icon={Music}
            message="暂无音乐"
            action={isAdmin && (
              <Button onClick={handleScan}>扫描音乐</Button>
            )}
          />
        )
        : (
          <>
            <SongList
              songs={songsList}
              onPlaySong={handlePlaySong}
              currentSong={currentSong}
              isPlaying={isPlaying}
              actionRenderer={(song) => (
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
              )}
            />

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
      <Modal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="添加到播放列表"
      >
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
      </Modal>
    </div>
  );
}
