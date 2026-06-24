import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { albums as albumsApi } from "../services/api.ts";
import { usePlayerStore } from "../stores/playerStore.ts";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { BackButton } from "../components/ui/BackButton.tsx";
import { DetailHero } from "../components/DetailHero.tsx";
import { SongList } from "../components/SongList.tsx";
import { Disc, Music, Play } from "lucide-react";
import type { Album } from "../types/index.ts";

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    setPlaylist: setStorePlaylist,
    setIsPlaying,
    isPlaying,
    currentSong,
    togglePlay,
  } = usePlayerStore();

  const fetchAlbum = async () => {
    if (!id) return;
    try {
      const data = await albumsApi.get(parseInt(id));
      setAlbum(data);
    } catch (error) {
      console.error("Failed to fetch album:", error);
    }
    setIsLoading(false);
  };

  const handlePlayAll = () => {
    if (!album?.songs) return;
    setStorePlaylist(album.songs, 0);
    setIsPlaying(true);
  };

  const handlePlaySong = (song: any, index: number) => {
    if (!album?.songs) return;
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      setStorePlaylist(album.songs, index);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    fetchAlbum();
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-6"><LoadingState /></div>;
  }

  if (!album) {
    return <div className="container mx-auto p-6 text-center">专辑不存在</div>;
  }

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
          <Button onClick={handlePlayAll} className="w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4" />
            播放全部
          </Button>
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
          />
        )
        : <EmptyState icon={Music} message="专辑为空" />}
    </div>
  );
}
