import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { playlists as playlistsApi } from "../services/api.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card.tsx";
import { ListMusic, Music, Plus, Trash2 } from "lucide-react";
import type { Playlist as PlaylistType } from "../types/index.ts";

const API_BASE = "http://localhost:8000";

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");

  const fetchPlaylists = async () => {
    try {
      const data = await playlistsApi.list();
      setPlaylists(data);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
    setIsLoading(false);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await playlistsApi.create(newPlaylistName, newPlaylistDesc);
      setShowCreateModal(false);
      setNewPlaylistName("");
      setNewPlaylistDesc("");
      fetchPlaylists();
    } catch (error) {
      alert("创建失败");
    }
  };

  const handleDeletePlaylist = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("确定要删除这个歌单吗?")) return;
    try {
      await playlistsApi.delete(id);
      fetchPlaylists();
    } catch (error) {
      alert("删除失败");
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">我的歌单</h1>
        <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          创建歌单
        </Button>
      </div>

      {isLoading
        ? <div className="text-center py-12">加载中...</div>
        : playlists.length === 0
        ? (
          <div className="text-center py-12">
            <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无歌单</p>
            <Button onClick={() => setShowCreateModal(true)}>
              创建第一个歌单
            </Button>
          </div>
        )
        : (
          <>
            {/* Mobile list view - shown on mobile only */}
            <div className="md:hidden space-y-2">
              {playlists.map((playlist) => (
                <Link key={playlist.id} to={`/playlist/${playlist.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer">
                    <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {playlist.cover_image
                        ? (
                          <img
                            src={API_BASE + playlist.cover_image}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                        )
                        : (
                          <Music className="h-6 w-6 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{playlist.name}</p>
                      {playlist.description && (
                        <p className="text-xs text-muted-foreground truncate">{playlist.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {playlist.song_count || 0} 首歌曲
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                      onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop grid view - hidden on mobile */}
            <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {playlists.map((playlist) => (
                <Link key={playlist.id} to={`/playlist/${playlist.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer backdrop-blur-sm bg-background/50 h-full">
                    <CardHeader className="p-3 sm:p-4">
                      <div className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2 sm:mb-3 overflow-hidden">
                        {playlist.cover_image
                          ? (
                            <img
                              src={API_BASE + playlist.cover_image}
                              alt={playlist.name}
                              className="w-full h-full object-cover"
                            />
                          )
                          : (
                            <Music className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                          )}
                      </div>
                      <CardTitle className="text-base sm:text-lg">{playlist.name}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {playlist.song_count || 0} 首歌曲
                      </p>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={(e) =>
                          handleDeletePlaylist(playlist.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>创建歌单</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePlaylist} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">歌单名称</label>
                  <Input
                    placeholder="请输入歌单名称"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述 (可选)</label>
                  <Input
                    placeholder="请输入描述"
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit">创建</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
