import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { artists as artistsApi } from "../services/api.ts";
import { AddToPlaylistModal } from "../components/AddToPlaylistModal.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card, CardHeader, CardTitle } from "../components/ui/Card.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { BackButton } from "../components/ui/BackButton.tsx";
import { CoverImage } from "../components/ui/CoverImage.tsx";
import { DetailHero } from "../components/DetailHero.tsx";
import { CollectionGrid } from "../components/CollectionGrid.tsx";
import { Disc, ListPlus, Users } from "lucide-react";
import type { Artist } from "../types/index.ts";

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addSongIds, setAddSongIds] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadArtist = async () => {
      if (!id) return;
      try {
        const data = await artistsApi.get(parseInt(id));
        if (isMounted) setArtist(data);
      } catch (error) {
        console.error("Failed to fetch artist:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadArtist();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-6"><LoadingState /></div>;
  }

  if (!artist) {
    return <div className="container mx-auto p-6 text-center">艺术家不存在</div>;
  }

  const artistSongIds = artist.songs?.map((song) => song.id) ?? [];

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <BackButton />

      <DetailHero
        coverSrc={null}
        coverAlt={artist.name}
        fallbackIcon={Users}
        title={artist.name}
        subtitle={artist.alias}
        meta={`${artist.song_count ?? artistSongIds.length} 首歌曲 · ${artist.albums?.length || 0} 张专辑`}
        roundCover
        actions={
          <Button
            variant="secondary"
            onClick={() => setAddSongIds(artistSongIds)}
            disabled={artistSongIds.length === 0}
            className="w-full sm:w-auto"
          >
            <ListPlus className="mr-2 h-4 w-4" />
            添加全部到歌单
          </Button>
        }
      />

      {artist.albums && artist.albums.length > 0
        ? (
          <>
            <h2 className="text-xl font-semibold mb-4">专辑</h2>
            <CollectionGrid
              items={artist.albums}
              renderCard={(album) => (
                <Link key={album.id} to={`/albums/${album.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer backdrop-blur-sm bg-background/50 h-full">
                    <CardHeader className="p-3 sm:p-4">
                      <CoverImage
                        src={album.cover_image}
                        alt={album.title}
                        fallbackIcon={Disc}
                        className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2 sm:mb-3 overflow-hidden"
                        fallbackClassName="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground"
                      />
                      <CardTitle className="text-base sm:text-lg truncate">{album.title}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              )}
              renderMobileItem={(album) => (
                <Link key={album.id} to={`/albums/${album.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer">
                    <CoverImage
                      src={album.cover_image}
                      alt={album.title}
                      fallbackIcon={Disc}
                      className="w-14 h-14 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                      fallbackClassName="h-6 w-6 text-muted-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{album.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </div>
                  </div>
                </Link>
              )}
            />
          </>
        )
        : <EmptyState icon={Disc} message="暂无专辑" />}

      <AddToPlaylistModal
        isOpen={addSongIds.length > 0}
        onClose={() => setAddSongIds([])}
        songIds={addSongIds}
      />
    </div>
  );
}
