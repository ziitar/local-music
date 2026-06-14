import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button.tsx";
import { Library, ListMusic, Music } from "lucide-react";
import { useAuthStore } from "../stores/authStore.ts";

export function HomePage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="text-center py-8 sm:py-16 bg-background/50 rounded-lg">
        <Music className="h-16 w-16 sm:h-24 sm:w-24 mx-auto text-primary mb-4 sm:mb-6" />
        <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">欢迎使用本地音乐播放器</h1>
        <p className="text-foreground mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base px-4">
          扫描本地音乐文件夹，享受高品质音乐播放。支持多种音质选择，创建个性化歌单。
        </p>

        {isAuthenticated
          ? (
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Link to="/library">
                <Button size="lg" className="w-full sm:w-auto">
                  <Library className="mr-2 h-5 w-5" />
                  音乐库
                </Button>
              </Link>
              <Link to="/playlists">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <ListMusic className="mr-2 h-5 w-5" />
                  我的歌单
                </Button>
              </Link>
            </div>
          )
          : (
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">登录</Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  注册
                </Button>
              </Link>
            </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-10 sm:mt-16">
        <div className="p-6 border rounded-lg bg-background/50">
          <h3 className="text-xl font-semibold mb-2">多音质支持</h3>
          <p className="text-muted-foreground">
            支持无损、320k、192k、128k等多种音质，畅享高品质音乐。
          </p>
        </div>
        <div className="p-6 border rounded-lg bg-background/50">
          <h3 className="text-xl font-semibold mb-2">个性化歌单</h3>
          <p className="text-muted-foreground">
            创建专属歌单，整理你喜欢的音乐，随心所欲播放。
          </p>
        </div>
        <div className="p-6 border rounded-lg bg-background/50">
          <h3 className="text-xl font-semibold mb-2">自动扫描</h3>
          <p className="text-muted-foreground">
            自动扫描本地音乐文件夹，读取ID3信息，智能识别歌手专辑。
          </p>
        </div>
      </div>
    </div>
  );
}
