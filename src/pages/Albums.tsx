import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { albums as albumsApi } from "../services/api.ts";
import { Input } from "../components/ui/Input.tsx";
import {
  Card,
  CardHeader,
  CardTitle,
} from "../components/ui/Card.tsx";
import { Disc } from "lucide-react";
import type { Album } from "../types/index.ts";

import { API_BASE } from "../config";

// Called by: src/App.tsx as route /albums
// Data: reads Album[] via albumsApi.list() → GET /api/albums
// User instruction: "点击专辑的菜单，可以进入到专辑列表"

export function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchAlbums(1, debouncedSearch);
  }, [debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    fetchAlbums(newPage, debouncedSearch);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">专辑</h1>
        <div className="w-full sm:w-64">
          <Input
            placeholder="搜索专辑..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {isLoading
        ? <div className="text-center py-12">加载中...</div>
        : albums.length === 0
        ? (
          <div className="text-center py-12">
            <Disc className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch ? "未找到匹配的专辑" : "暂无专辑"}
            </p>
          </div>
        )
        : (
          <>
            <div className="md:hidden">
              {albums.map((album) => (
                <Link key={album.id} to={`/albums/${album.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer space-y-2">
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
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {albums.map((album) => (
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
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {album.release_year || '未知年份'} · {album.song_count || 0} 首
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
