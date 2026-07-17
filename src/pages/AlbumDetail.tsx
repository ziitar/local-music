import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { albums as albumsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { AddToPlaylistModal } from "../components/AddToPlaylistModal.tsx";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { BackButton } from "../components/ui/BackButton.tsx";
import { DetailHero } from "../components/DetailHero.tsx";
import { SongList } from "../components/SongList.tsx";
import { Disc, ListPlus, Music, Play } from "lucide-react";
import type { Album, Song } from "../types/index.ts";

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addSongIds, setAddSongIds] = useState<number[]>([]);

  const {
    setPlaylist: setStorePlaylist,
    setIsPlaying,
    isPlaying,
    currentSong,
    togglePlay,
  } = usePlayerStore();

  const handlePlayAll = () => {
    if (!album?.songs?.length) return;
    setStorePlaylist(album.songs, 0);
    setIsPlaying(true);
  };

  const handlePlaySong = (song: Song, index: number) => {
    if (!album?.songs) return;
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      setStorePlaylist(album.songs, index);
      setIsPlaying(true);
    }
  };

  const openAddToPlaylist = (songIds: number[]) => {
    if (songIds.length === 0) return;
    setAddSongIds(songIds);
  };

  useEffect(() => {
    let isMounted = true;

    const loadAlbum = async () => {
      if (!id) return;
      try {
        const data = await albumsApi.get(parseInt(id));
        if (isMounted) setAlbum(data);
      } catch (error) {
        console.error("Failed to fetch album:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadAlbum();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-6"><LoadingState /></div>;
  }

  if (!album) {
    return <div className="container mx-auto p-6 text-center">专辑不存在</div>;
  }

  const albumSongIds = album.songs?.map((song) => song.id) ?? [];

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <BackButton />

      <DetailHero
        coverSrc={album.cover_image}
        coverAlt={album.title}
        fallbackIcon={Disc}
        title={album.title}
        subtitle={album.artist}
        meta={`${album.release_year || '未知年份'} · ${album.songs?.length || 0} 首歌曲`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button onClick={handlePlayAll} className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              播放全部
            </Button>
            <Button
              variant="secondary"
              onClick={() => openAddToPlaylist(albumSongIds)}
              disabled={albumSongIds.length === 0}
              className="w-full sm:w-auto"
            >
              <ListPlus className="mr-2 h-4 w-4" />
              添加全部到歌单
            </Button>
          </div>
        }
      />

      {album.songs && album.songs.length > 0
        ? (
          <SongList
            songs={album.songs}
            onPlaySong={handlePlaySong}
            currentSong={currentSong}
            isPlaying={isPlaying}
            showAlbum={false}
            qualityVariant="dark"
            trackNumberMode="trackNo"
            actionRenderer={(song) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  openAddToPlaylist([song.id]);
                }}
                aria-label="添加到歌单"
                title="添加到歌单"
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            )}
          />
        )
        : <EmptyState icon={Music} message="专辑为空" />}

      <AddToPlaylistModal
        isOpen={addSongIds.length > 0}
        onClose={() => setAddSongIds([])}
        songIds={addSongIds}
      />
    </div>
  );
}
