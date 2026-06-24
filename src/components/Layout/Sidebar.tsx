import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.ts";
import { Button } from "../ui/Button.tsx";
import { useIsDesktop } from "../../hooks/useMediaQuery.ts";
import { Home, Library, ListMusic, Settings, Users, Disc, X } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onLinkClick: () => void;
}

export function Sidebar({ isOpen, onLinkClick }: SidebarProps) {
  const location = useLocation();
  const { user, isAdmin } = useAuthStore();
  const isDesktop = useIsDesktop();

  const navItems = [
    { path: "/", icon: Home, label: "首页" },
    { path: "/library", icon: Library, label: "音乐库" },
    { path: "/artists", icon: Users, label: "艺术家" },
    { path: "/albums", icon: Disc, label: "专辑" },
    { path: "/playlists", icon: ListMusic, label: "歌单" },
  ];

  const settingsItem = { path: "/settings", icon: Settings, label: "设置" };

  const renderNavList = (onItemClick?: () => void) => (
    <ul className="space-y-2">
      {navItems.map((item) => {
        const isActive = item.path === "/"
          ? location.pathname === "/"
          : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
        return (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-white/10"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          </li>
        );
      })}
      {user && (
        <li key={settingsItem.path}>
          <Link
            to={settingsItem.path}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
              location.pathname === settingsItem.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-white/10"
            }`}
          >
            <settingsItem.icon className="h-5 w-5" />
            {settingsItem.label}
            {isAdmin && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </Link>
        </li>
      )}
    </ul>
  );

  // Desktop: fixed sidebar, always mounted
  if (isDesktop) {
    return (
      <aside className="w-64 h-screen flex flex-col backdrop-blur-xl bg-background/70 border-r border-white/10 flex-shrink-0 z-20">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold">本地音乐</h1>
        </div>
        <nav className="flex-1 p-4">
          {renderNavList()}
        </nav>
      </aside>
    );
  }

  // Mobile: drawer sidebar, only mounted when open
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-30"
        onClick={onLinkClick}
      />
      <aside className="fixed top-0 left-0 h-full w-64 z-40 flex flex-col backdrop-blur-xl bg-background/95 border-r border-white/10 transform translate-x-0 transition-transform duration-300 ease-in-out">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-xl font-bold">本地音乐</h1>
          <Button variant="ghost" size="icon" onClick={onLinkClick}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 p-4">
          {renderNavList(onLinkClick)}
        </nav>
      </aside>
    </>
  );
}
