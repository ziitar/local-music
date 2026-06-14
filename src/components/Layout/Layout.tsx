import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { PlayerBar } from "../Player/PlayerBar.tsx";
import { usePlayerStore } from "../../stores/playerStore.ts";
import { useAuthStore } from "../../stores/authStore.ts";
import { Menu, LogOut, User } from "lucide-react";
import { Button } from "../ui/Button.tsx";
import { API_BASE } from "../../config";

export function Layout() {
  const { currentSong } = usePlayerStore();
  const { user, logout, isAdmin } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const handleLinkClick = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // Get cover image URL from current song
  const coverUrl = currentSong?.cover_image
    ? `${API_BASE}${currentSong.cover_image}`
    : null;

  return (
    <div className="flex h-screen relative overflow-hidden" style={{
      backgroundImage: coverUrl ? `url(${coverUrl})` : "unset",
      backgroundColor: coverUrl ? "unset" : "white",
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}>

      {/* Content with glass effect */}
      <div className="relative z-10 flex h-screen w-full backdrop-blur-sm bg-background/50 border border-white/10">
        {/* Mobile hamburger - inside the flex container, hidden when sidebar is open */}
        {isMobile && !isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 z-50"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        )}

        {/* Mobile overlay - only covers the main content area, not the sidebar */}
        {isSidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            style={{ marginLeft: "16rem" }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={isSidebarOpen} isMobile={isMobile} onLinkClick={handleLinkClick} />
        <main className={`flex-1 overflow-auto pb-20 md:pt-14 ${isMobile ? "pt-14" : ""}`}>
          {/* User info - visible at top right on both mobile and desktop */}
          {user && (
            <div className={`absolute top-3 right-4 z-20 flex items-center gap-3 ${isMobile ? "left-14" : ""}`}>
              {isAdmin && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                  Admin
                </span>
              )}
              <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10">
                <User className="h-4 w-4" />
                <span className="text-sm">{user.username}</span>
                <Button variant="ghost" size="icon" onClick={logout} className="h-7 w-7">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
        <PlayerBar />
      </div>
    </div>
  );
}
