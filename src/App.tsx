import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore.ts";
import { Layout } from "./components/Layout/Layout.tsx";
import { HomePage } from "./pages/Home.tsx";
import { LoginPage } from "./pages/Login.tsx";
import { RegisterPage } from "./pages/Register.tsx";
import { LibraryPage } from "./pages/Library.tsx";
import { PlaylistsPage } from "./pages/Playlists.tsx";
import { PlaylistDetailPage } from "./pages/PlaylistDetail.tsx";
import { SettingsPage } from "./pages/Settings.tsx";
import { isApiConfigured, setApiBaseUrl } from "./config.ts";
import { Button } from "./components/ui/Button.tsx";
import { Input } from "./components/ui/Input.tsx";
import { Server } from "lucide-react";

/** Detect if running on a Capacitor native platform. */
function isNativePlatform(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

/** First-run server configuration screen for native platforms. */
function ServerConfigScreen() {
  const [url, setUrl] = useState('');

  const handleSave = () => {
    if (url.trim()) {
      setApiBaseUrl(url.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full backdrop-blur-md bg-background/60 border border-white/10 p-8 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <Server className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Local Music</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          首次使用请配置服务器地址。输入你的 Local Music 服务器地址（例如 http://192.168.1.100:8000）
        </p>
        <div className="space-y-4">
          <Input
            placeholder="http://192.168.1.100:8000"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button onClick={handleSave} className="w-full" disabled={!url.trim()}>
            连接服务器
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          提示：确保手机和服务器在同一局域网内。
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  // On native platforms, show server config if not configured
  if (isNativePlatform() && !isApiConfigured()) {
    return <ServerConfigScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
