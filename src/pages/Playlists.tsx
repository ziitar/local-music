import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { playlists as playlistsApi } from "../services/api.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Card, CardHeader, CardTitle } from "../components/ui/Card.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { CoverImage } from "../components/ui/CoverImage.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { FormField } from "../components/ui/FormField.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { CollectionGrid } from "../components/CollectionGrid.tsx";
import { ListMusic, Music, Plus, Trash2 } from "lucide-react";
import type { Playlist as PlaylistType } from "../types/index.ts";

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
      <PageHeader
        title="我的歌单"
        action={
          <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            创建歌单
          </Button>
        }
      />

      {isLoading
        ? <LoadingState />
        : playlists.length === 0
        ? (
          <EmptyState
            icon={ListMusic}
            message="暂无歌单"
            action={<Button onClick={() => setShowCreateModal(true)}>创建第一个歌单</Button>}
          />
        )
        : (
          <CollectionGrid
            items={playlists}
            renderCard={(playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer backdrop-blur-sm bg-background/50 h-full">
                  <CardHeader className="p-3 sm:p-4">
                    <CoverImage
                      src={playlist.cover_image}
                      alt={playlist.name}
                      fallbackIcon={Music}
                      className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2 sm:mb-3 overflow-hidden"
                      fallbackClassName="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground"
                    />
                    <CardTitle className="text-base sm:text-lg">{playlist.name}</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {playlist.song_count || 0} 首歌曲
                    </p>
                  </CardHeader>
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            )}
            renderMobileItem={(playlist, index, arr) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`}>
                <div className={`flex items-center gap-3 p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 hover:bg-white/50 cursor-pointer ${index!==(arr.length -1)? 'mb-4':''}`}>
                  <CoverImage
                    src={playlist.cover_image}
                    alt={playlist.name}
                    fallbackIcon={Music}
                    className="w-14 h-14 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                    fallbackClassName="h-6 w-6 text-muted-foreground"
                  />
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
            )}
          />
        )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建歌单"
      >
        <form onSubmit={handleCreatePlaylist} className="space-y-4">
          <FormField label="歌单名称">
            <Input
              placeholder="请输入歌单名称"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              required
            />
          </FormField>
          <FormField label="描述 (可选)">
            <Input
              placeholder="请输入描述"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
            />
          </FormField>
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
      </Modal>
    </div>
  );
}
