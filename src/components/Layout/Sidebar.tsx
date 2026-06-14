import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.ts";
import { Button } from "../ui/Button.tsx";
import { Home, Library, ListMusic, LogOut, Settings, User, X } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onLinkClick: () => void;
}

export function Sidebar({ isOpen, isMobile, onLinkClick }: SidebarProps) {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuthStore();

  const navItems = [
    { path: "/", icon: Home, label: "首页" },
    { path: "/library", icon: Library, label: "音乐库" },
    { path: "/playlists", icon: ListMusic, label: "歌单" },
  ];

  // Settings link only shown for logged-in users
  const settingsItem = { path: "/settings", icon: Settings, label: "设置" };

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <aside className={`hidden md:flex w-64 h-screen flex-col backdrop-blur-xl bg-background/70 border-r border-white/10 flex-shrink-0 z-20`}>
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold">本地音乐</h1>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
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
        </nav>

        <div className="p-4 border-t border-white/10">
          {user
            ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="text-sm">{user.username}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )
            : (
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  登录
                </Button>
              </Link>
            )}
        </div>
      </aside>

      {/* Mobile sidebar - drawer style */}
      <aside className={`fixed md:hidden top-0 left-0 h-full w-64 z-40 flex flex-col backdrop-blur-xl bg-background/95 border-r border-white/10 transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-xl font-bold">本地音乐</h1>
          <Button variant="ghost" size="icon" onClick={onLinkClick}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onLinkClick}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
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
                  onClick={onLinkClick}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
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
        </nav>

        <div className="p-4 border-t border-white/10">
          {user
            ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="text-sm">{user.username}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )
            : (
              <Link to="/login" onClick={onLinkClick}>
                <Button variant="outline" className="w-full">
                  登录
                </Button>
              </Link>
            )}
        </div>
      </aside>
    </>
  );
}
