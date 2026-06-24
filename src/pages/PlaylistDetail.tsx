import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { playlists as playlistsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { BackButton } from "../components/ui/BackButton.tsx";
import { DetailHero } from "../components/DetailHero.tsx";
import { SongList } from "../components/SongList.tsx";
import { useDebounce } from "../hooks/useDebounce.ts";
import { Music, Play, Search, Trash2 } from "lucide-react";
import type { Playlist as PlaylistType } from "../types/index.ts";

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

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
    if (!filteredSongs.length) return;
    setStorePlaylist(filteredSongs, 0);
    setIsPlaying(true);
  };

  const handlePlaySong = (song: any, filteredIndex: number) => {
    if (!filteredSongs.length) return;
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      setStorePlaylist(filteredSongs, filteredIndex);
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

  const filteredSongs = useMemo(() => {
    if (!playlist?.songs) return [];
    if (!debouncedSearch) return playlist.songs;
    const query = debouncedSearch.toLowerCase();
    return playlist.songs.filter((song) =>
      song.title.toLowerCase().includes(query)
      || song.artist.toLowerCase().includes(query)
      || (song.album && song.album.toLowerCase().includes(query))
    );
  }, [playlist?.songs, debouncedSearch]);

  if (isLoading) {
    return <div className="container mx-auto p-6"><LoadingState /></div>;
  }

  if (!playlist) {
    return <div className="container mx-auto p-6 text-center">歌单不存在</div>;
  }

  const coverImage = playlist.songs && playlist.songs.length > 0
    ? playlist.songs[playlist.songs.length - 1]?.cover_image
    : null;

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <BackButton />

      <DetailHero
        coverSrc={coverImage}
        coverAlt={playlist.name}
        fallbackIcon={Music}
        title={playlist.name}
        subtitle={playlist.description}
        meta={`${playlist.songs?.length || 0} 首歌曲`}
        actions={
          <Button onClick={handlePlayAll} className="w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4" />
            播放全部
          </Button>
        }
      />

      {playlist.songs && playlist.songs.length > 0
        ? (
          <>
            {/* Search bar */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索歌曲、歌手、专辑..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              {debouncedSearch && (
                <p className="text-xs text-muted-foreground mt-1">
                  找到 {filteredSongs.length} / {playlist.songs.length} 首歌曲
                </p>
              )}
            </div>

            {filteredSongs.length === 0
              ? <EmptyState icon={Search} message="未找到匹配的歌曲" />
              : (
                <SongList
                  songs={filteredSongs}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  qualityVariant="dark"
                  actionRenderer={(song) => (
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
                  )}
                />
              )}
          </>
        )
        : <EmptyState icon={Music} message="歌单为空" />}
    </div>
  );
}
