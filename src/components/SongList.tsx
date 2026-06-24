import { useIsDesktop } from "../hooks/useMediaQuery.ts";
import { formatDuration } from "../lib/utils.ts";
import { QualityBadge } from "./ui/QualityBadge.tsx";
import { Pause, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { Song } from "../types/index.ts";

interface SongListProps {
  songs: Song[];
  onPlaySong: (song: Song, index: number) => void;
  currentSong?: Song | null;
  isPlaying: boolean;
  /** Show album column in desktop table. Defaults to true. */
  showAlbum?: boolean;
  /** Render an action cell per song (e.g. add-to-playlist button). */
  actionRenderer?: (song: Song, index: number) => ReactNode;
  /** Quality badge variant for desktop table. */
  qualityVariant?: "light" | "dark";
  /** Track number display: "sequential" uses index+1, "trackNo" uses song.track_no || index+1 */
  trackNumberMode?: "sequential" | "trackNo";
}

export function SongList({
  songs,
  onPlaySong,
  currentSong,
  isPlaying,
  showAlbum = true,
  actionRenderer,
  qualityVariant = "light",
  trackNumberMode = "sequential",
}: SongListProps) {
  const isDesktop = useIsDesktop();

  const getIndex = (song: Song, index: number) =>
    trackNumberMode === "trackNo" ? song.track_no || index + 1 : index + 1;

  if (isDesktop) {
    return (
      <div className="border rounded-lg overflow-x-auto backdrop-blur-md bg-background/60 border-white/10">
        <table className="w-full min-w-[500px]">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-3 text-left text-sm font-medium w-12">#</th>
              <th className="px-3 py-3 text-left text-sm font-medium">歌曲</th>
              <th className="px-3 py-3 text-left text-sm font-medium">歌手</th>
              {showAlbum && (
                <th className="px-3 py-3 text-left text-sm font-medium">专辑</th>
              )}
              <th className="px-3 py-3 text-left text-sm font-medium">音质</th>
              <th className="px-3 py-3 text-left text-sm font-medium w-24">时长</th>
              {actionRenderer && (
                <th className="px-3 py-3 text-left text-sm font-medium">操作</th>
              )}
            </tr>
          </thead>
          <tbody>
            {songs.map((song, index) => (
              <tr
                key={song.id}
                className={`border-t border-white/10 hover:bg-white/10 cursor-pointer ${
                  currentSong?.id === song.id ? "bg-primary/20" : ""
                }`}
                onClick={() => onPlaySong(song, index)}
              >
                <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                  {currentSong?.id === song.id ? (
                    isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )
                  ) : (
                    getIndex(song, index)
                  )}
                </td>
                <td className="px-3 py-2 sm:py-3 font-medium">{song.title}</td>
                <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                  {song.artist}
                </td>
                {showAlbum && (
                  <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                    {song.album}
                  </td>
                )}
                <td className="px-3 py-2 sm:py-3 text-sm">
                  <QualityBadge quality={song.quality} variant={qualityVariant} />
                </td>
                <td className="px-3 py-2 sm:py-3 text-sm text-muted-foreground">
                  {formatDuration(song.duration)}
                </td>
                {actionRenderer && (
                  <td className="px-3 py-2 sm:py-3">
                    {actionRenderer(song, index)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Mobile card view
  return (
    <div className="space-y-2">
      {songs.map((song, index) => (
        <div
          key={song.id}
          className={`p-3 rounded-lg border backdrop-blur-md bg-background/60 border-white/10 cursor-pointer ${
            currentSong?.id === song.id ? "bg-primary/30" : "hover:bg-white/50"
          }`}
          onClick={() => onPlaySong(song, index)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 flex-shrink-0 text-center">
              {currentSong?.id === song.id ? (
                isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )
              ) : (
                <span className="text-sm text-muted-foreground">
                  {getIndex(song, index)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{song.title}</p>
              <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                {showAlbum && song.album && (
                  <>
                    <span className="text-xs text-muted-foreground">{song.album}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                  </>
                )}
                <QualityBadge quality={song.quality} />
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(song.duration)}
                </span>
              </div>
            </div>
            {actionRenderer && (
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {actionRenderer(song, index)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
