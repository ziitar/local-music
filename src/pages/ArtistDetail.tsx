import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { artists as artistsApi } from "../services/api.ts";
import { Button } from "../components/ui/Button.tsx";
import {
  Card,
  CardHeader,
  CardTitle,
} from "../components/ui/Card.tsx";
import { ArrowLeft, Users, Disc } from "lucide-react";
import type { Artist } from "../types/index.ts";

import { API_BASE } from "../config";

// Called by: src/App.tsx as route /artists/:id
// Data: reads Artist (with albums[]) via artistsApi.get(id) → GET /api/artists/:id
// User instruction: "点击单独的艺术家列表进去，可以进入艺术家详情，艺术家详情内容就是艺术家的名称以及他的所有专辑"

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArtist = async () => {
    if (!id) return;
    try {
      const data = await artistsApi.get(parseInt(id));
      setArtist(data);
    } catch (error) {
      console.error("Failed to fetch artist:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchArtist();
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center">加载中...</div>;
  }

  if (!artist) {
    return <div className="container mx-auto p-6 text-center">艺术家不存在</div>;
  }

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
        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <Users className="h-12 w-12 sm:h-24 sm:w-24 text-muted-foreground" />
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{artist.name}</h1>
          {artist.alias && (
            <p className="text-muted-foreground mb-2">{artist.alias}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {artist.albums?.length || 0} 张专辑
          </p>
        </div>
      </div>

      {artist.albums && artist.albums.length > 0
        ? (
          <>
            <h2 className="text-xl font-semibold mb-4">专辑</h2>
            <div className="md:hidden space-y-2">
              {artist.albums.map((album) => (
                <Link key={album.id} to={`/albums/${album.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer">
                    <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {album.cover_image
                        ? (
                          <img
                            src={API_BASE + album.cover_image}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        )
                        : (
                          <Disc className="h-6 w-6 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{album.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {artist.albums.map((album) => (
                <Link key={album.id} to={`/albums/${album.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer backdrop-blur-sm bg-background/50 h-full">
                    <CardHeader className="p-3 sm:p-4">
                      <div className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2 sm:mb-3 overflow-hidden">
                        {album.cover_image
                          ? (
                            <img
                              src={API_BASE + album.cover_image}
                              alt={album.title}
                              className="w-full h-full object-cover"
                            />
                          )
                          : (
                            <Disc className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                          )}
                      </div>
                      <CardTitle className="text-base sm:text-lg truncate">{album.title}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )
        : (
          <div className="text-center py-12">
            <Disc className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无专辑</p>
          </div>
        )}
    </div>
  );
}
