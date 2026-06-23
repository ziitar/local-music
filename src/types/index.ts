export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export interface Config {
  music_sources: string[];
  exclude_paths: string[];
}

export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file_path: string;
  quality: string;
  file_size: number;
  format: string;
  cover_image?: string;
  created_at?: string;
  album_id?: number;
  track_no?: number;
  // 整轨音乐相关字段
  is_cue_track?: boolean;
  cue_file_path?: string;
  track_start_time?: number;
  track_end_time?: number;
}

export interface Artist {
  id: number;
  name: string;
  alias: string | null;
  song_count?: number;
  album_count?: number;
  albums?: Album[];
  created_at?: string;
}

export interface Album {
  id: number;
  title: string;
  cover_image: string | null;
  thumbnail: string | null;
  track_total: number | null;
  disk_total: number | null;
  release_year: number | null;
  artist?: string;
  song_count?: number;
  songs?: Song[];
  created_at?: string;
}

export interface LyricsResponse {
  lrc: string | null;
  translated_lrc?: string | null;
}

export interface ArtistsResponse {
  artists: Artist[];
  pagination: Pagination;
}

export interface AlbumsResponse {
  albums: Album[];
  pagination: Pagination;
}

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at?: string;
  song_count?: number;
  cover_image?: string;
  songs?: Song[];
}

export interface PlayHistory {
  id: number;
  played_at: string;
  song_id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  quality: string;
  format: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SongsResponse {
  songs: Song[];
  pagination: Pagination;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: User;
}
