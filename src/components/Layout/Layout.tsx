import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { PlayerBar } from "../Player/PlayerBar.tsx";
import { usePlayerStore } from "../../stores/playerStore.ts";
import { useAuthStore } from "../../stores/authStore.ts";
import { ChangePasswordModal } from "../ChangePasswordModal.tsx";
import { Menu, LogOut, User, ChevronDown, Lock } from "lucide-react";
import { Button } from "../ui/Button.tsx";
import { API_BASE } from "../../config";

export function Layout() {
  const { currentSong } = usePlayerStore();
  const { user, logout, isAdmin } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

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
        <main className={`flex-1 overflow-y-auto no-scrollbar pb-20 md:pt-14 ${isMobile ? "pt-14" : ""}`}>
          {/* User info - visible at top right on both mobile and desktop */}
          {user && (
            <div className={`absolute top-3 right-4 z-20 flex items-center gap-3 ${isMobile ? "left-14" : ""}`}>
              {isAdmin && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                  Admin
                </span>
              )}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10 hover:bg-background/80 transition-colors cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm">{user.username}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-background/95 backdrop-blur-xl border border-white/10 rounded-md shadow-lg overflow-hidden">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsPasswordModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors text-left"
                    >
                      <Lock className="h-4 w-4" />
                      修改密码
                    </button>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors text-left text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
        <PlayerBar />
      </div>
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
