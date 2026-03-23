import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { config as configApi } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  FolderOpen,
  FolderX,
  Plus,
  Save,
  Settings,
  Trash2,
} from "lucide-react";
import type { Config } from "../types";

export function SettingsPage() {
  const { isAdmin } = useAuthStore();
  const [config, setConfig] = useState<Config>({
    music_sources: [],
    exclude_paths: [],
  });
  const [newSource, setNewSource] = useState("");
  const [newExclude, setNewExclude] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await configApi.get();
      console.log("Config API response:", data);

      // Handle various data formats
      let sources: string[] = [];
      let excludes: string[] = [];

      if (data.music_sources) {
        if (Array.isArray(data.music_sources)) {
          sources = data.music_sources;
        } else if (typeof data.music_sources === 'string') {
          try {
            const parsed = JSON.parse(data.music_sources);
            sources = Array.isArray(parsed) ? parsed : [];
          } catch {
            sources = [];
          }
        }
      }

      if (data.exclude_paths) {
        if (Array.isArray(data.exclude_paths)) {
          excludes = data.exclude_paths;
        } else if (typeof data.exclude_paths === 'string') {
          try {
            const parsed = JSON.parse(data.exclude_paths);
            excludes = Array.isArray(parsed) ? parsed : [];
          } catch {
            excludes = [];
          }
        }
      }

      setConfig({
        music_sources: sources.filter((v): v is string => typeof v === 'string'),
        exclude_paths: excludes.filter((v): v is string => typeof v === 'string'),
      });
    } catch (error) {
      console.error("Failed to fetch config:", error);
      setMessage({ type: "error", text: "Failed to load configuration" });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await configApi.update(config);
      setMessage({ type: "success", text: "Configuration saved successfully" });
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to save configuration: " + (error as Error).message,
      });
    }
    setIsSaving(false);
  };

  const addSource = () => {
    if (newSource.trim()) {
      setConfig({
        ...config,
        music_sources: [...config.music_sources, newSource.trim()],
      });
      setNewSource("");
    }
  };

  const removeSource = (index: number) => {
    setConfig({
      ...config,
      music_sources: config.music_sources.filter((_, i) => i !== index),
    });
  };

  const addExclude = () => {
    if (newExclude.trim()) {
      setConfig({
        ...config,
        exclude_paths: [...config.exclude_paths, newExclude.trim()],
      });
      setNewExclude("");
    }
  };

  const removeExclude = (index: number) => {
    setConfig({
      ...config,
      exclude_paths: config.exclude_paths.filter((_, i) => i !== index),
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground">
            Only administrators can configure music paths.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Music Source Paths */}
      <div className="mb-8 backdrop-blur-md bg-background/60 border border-white/10 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Music Source Paths
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          Directories to scan for music files. Supports multiple paths.
        </p>

        <div className="space-y-2 mb-4">
          {config.music_sources.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              No source paths configured. Add at least one path to scan music.
            </p>
          ) : (
            config.music_sources.map((source, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={source} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSource(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter path (e.g., Y:\Music or /home/user/Music)"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSource()}
            className="flex-1"
          />
          <Button onClick={addSource}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Exclude Paths */}
      <div className="mb-8 backdrop-blur-md bg-background/60 border border-white/10 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FolderX className="h-5 w-5" />
          Exclude Paths
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          Directories or patterns to skip during scanning.
        </p>

        <div className="space-y-2 mb-4">
          {config.exclude_paths.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              No exclude paths configured.
            </p>
          ) : (
            config.exclude_paths.map((path, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={path} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExclude(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter path or pattern to exclude (e.g., tmp, .cache)"
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExclude()}
            className="flex-1"
          />
          <Button onClick={addExclude}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="gap-2">
        <Save className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}
