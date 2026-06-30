import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore.ts";
import { Layout } from "./components/Layout/Layout.tsx";
import { HomePage } from "./pages/Home.tsx";
import { LoginPage } from "./pages/Login.tsx";
import { RegisterPage } from "./pages/Register.tsx";
import { LibraryPage } from "./pages/Library.tsx";
import { ArtistsPage } from "./pages/Artists.tsx";
import { ArtistDetailPage } from "./pages/ArtistDetail.tsx";
import { AlbumsPage } from "./pages/Albums.tsx";
import { AlbumDetailPage } from "./pages/AlbumDetail.tsx";
import { PlaylistsPage } from "./pages/Playlists.tsx";
import { PlaylistDetailPage } from "./pages/PlaylistDetail.tsx";
import { SettingsPage } from "./pages/Settings.tsx";
import { SongDetailPage } from "./pages/SongDetail.tsx";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        加载中...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        加载中...
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artists"
            element={
              <ProtectedRoute>
                <ArtistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artists/:id"
            element={
              <ProtectedRoute>
                <ArtistDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/albums"
            element={
              <ProtectedRoute>
                <AlbumsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/albums/:id"
            element={
              <ProtectedRoute>
                <AlbumDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <PlaylistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlist/:id"
            element={
              <ProtectedRoute>
                <PlaylistDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/song/:id"
            element={
              <ProtectedRoute>
                <SongDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
