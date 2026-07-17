import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { playlists as playlistsApi } from "../services/api.ts";
import { Button } from "./ui/Button.tsx";
import { Modal } from "./ui/Modal.tsx";
import type { Playlist } from "../types/index.ts";

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songIds: number[];
}

export function AddToPlaylistModal({
  isOpen,
  onClose,
  songIds,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadPlaylists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await playlistsApi.list();
        setPlaylists(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载歌单失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaylists();
  }, [isOpen]);

  const handleAdd = async (playlist: Playlist) => {
    if (songIds.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (songIds.length === 1) {
        await playlistsApi.addSong(playlist.id, songIds[0]);
      } else {
        await playlistsApi.addSongs(playlist.id, songIds);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加到歌单失败");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="添加到歌单">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          将 {songIds.length} 首歌曲添加到：
        </p>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            加载歌单中...
          </div>
        ) : playlists.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无歌单，请先创建歌单
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleAdd(playlist)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <ListPlus className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {playlist.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {playlist.song_count ?? 0} 首歌曲
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
        </div>
      </div>
    </Modal>
  );
}
