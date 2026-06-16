import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { artists as artistsApi } from "../services/api.ts";
import { Input } from "../components/ui/Input.tsx";
import {
  Card,
  CardHeader,
  CardTitle,
} from "../components/ui/Card.tsx";
import { Users } from "lucide-react";
import type { Artist } from "../types/index.ts";

// Called by: src/App.tsx as route /artists
// Data: reads Artist[] via artistsApi.list() → GET /api/artists
// User instruction: "新增艺术家菜单...点击艺术家...可以看到仓库里的所有艺术家列表"

export function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchArtists = async (page: number = 1, search: string = "") => {
    try {
      const data = await artistsApi.list({ page, search: search || undefined });
      setArtists(data.artists);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch artists:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchArtists(1, debouncedSearch);
  }, [debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    fetchArtists(newPage, debouncedSearch);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">艺术家</h1>
        <div className="w-full sm:w-64">
          <Input
            placeholder="搜索艺术家..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {isLoading
        ? <div className="text-center py-12">加载中...</div>
        : artists.length === 0
        ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch ? "未找到匹配的艺术家" : "暂无艺术家"}
            </p>
          </div>
        )
        : (
          <>
            <div className="md:hidden space-y-2">
              {artists.map((artist) => (
                <Link key={artist.id} to={`/artists/${artist.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{artist.name}</p>
                      {artist.alias && (
                        <p className="text-xs text-muted-foreground truncate">{artist.alias}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {artist.album_count || 0} 张专辑 · {artist.song_count || 0} 首歌曲
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden md:grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {artists.map((artist) => (
                <Link key={artist.id} to={`/artists/${artist.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer backdrop-blur-sm bg-background/50 h-full">
                    <CardHeader className="p-2 sm:p-3 text-center">
                      <div className="aspect-square w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-muted rounded-full flex items-center justify-center mb-2">
                        <Users className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-sm sm:text-base truncate">{artist.name}</CardTitle>
                      {artist.alias && (
                        <p className="text-xs text-muted-foreground truncate">{artist.alias}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {artist.song_count || 0} 首
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </button>
                <span className="px-3 py-1 text-sm text-muted-foreground">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
