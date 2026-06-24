import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { albums as albumsApi } from "../services/api.ts";
import { Input } from "../components/ui/Input.tsx";
import { Card, CardHeader, CardTitle } from "../components/ui/Card.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { Pagination } from "../components/ui/Pagination.tsx";
import { CoverImage } from "../components/ui/CoverImage.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { CollectionGrid } from "../components/CollectionGrid.tsx";
import { useDebounce } from "../hooks/useDebounce.ts";
import { Disc } from "lucide-react";
import type { Album } from "../types/index.ts";

export function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlbums = async (page: number = 1, search: string = "") => {
    try {
      const data = await albumsApi.list({ page, search: search || undefined });
      setAlbums(data.albums);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch albums:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAlbums(1, debouncedSearch);
  }, [debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    fetchAlbums(newPage, debouncedSearch);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <PageHeader
        title="专辑"
        action={
          <div className="w-full sm:w-64">
            <Input
              placeholder="搜索专辑..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        }
      />

      {isLoading
        ? <LoadingState />
        : albums.length === 0
        ? <EmptyState icon={Disc} message={debouncedSearch ? "未找到匹配的专辑" : "暂无专辑"} />
        : (
          <>
            <CollectionGrid
              items={albums}
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
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
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
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </div>
                  </div>
                </Link>
              )}
            />

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
    </div>
  );
}
