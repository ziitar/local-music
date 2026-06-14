import { Router } from "@oak/oak";
import { sql } from "../services/db.ts";
import { requireAdmin, requireAuth } from "../middleware/admin.ts";

const router = new Router();

// GET /api/config - Get all configuration (requires auth)
router.get("/api/config", requireAuth, async (ctx) => {
  try {
    const result = await sql`
      SELECT key, value FROM config
    `;

    // Default config with empty arrays
    const config: Record<string, string[]> = {
      music_sources: [],
      exclude_paths: [],
    };

    for (const row of result) {
      const key = row.key;
      let value = row.value;

      // Handle JSONB value - could be string, object, or array
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          value = [];
        }
      }

      // Ensure values are arrays for these keys
      if (key === 'music_sources' || key === 'exclude_paths') {
        if (Array.isArray(value)) {
          config[key] = value.filter((v): v is string => typeof v === 'string');
        } else {
          config[key] = [];
        }
      }
    }

    ctx.response.body = config;
  } catch (error) {
    console.error("Failed to fetch config:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch configuration" };
  }
});

// PUT /api/config - Update configuration (admin only)
router.put("/api/config", requireAdmin, async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const { music_sources, exclude_paths } = body;

    // Validate music_sources is an array of strings
    if (
      music_sources !== undefined &&
      (!Array.isArray(music_sources) ||
        !music_sources.every((s: unknown) => typeof s === "string"))
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message: "music_sources must be an array of strings",
      };
      return;
    }

    // Validate exclude_paths is an array of strings
    if (
      exclude_paths !== undefined &&
      (!Array.isArray(exclude_paths) ||
        !exclude_paths.every((s: unknown) => typeof s === "string"))
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message: "exclude_paths must be an array of strings",
      };
      return;
    }

    const userId = ctx.state.user?.userId;

    // Update music_sources if provided
    if (music_sources !== undefined) {
      await sql`
        INSERT INTO config (key, value, updated_by)
        VALUES ('music_sources', ${JSON.stringify(music_sources)}::jsonb, ${userId})
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `;
    }

    // Update exclude_paths if provided
    if (exclude_paths !== undefined) {
      await sql`
        INSERT INTO config (key, value, updated_by)
        VALUES ('exclude_paths', ${JSON.stringify(exclude_paths)}::jsonb, ${userId})
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
      `;
    }

    ctx.response.body = {
      success: true,
      message: "Configuration updated",
    };
  } catch (error) {
    console.error("Failed to update config:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to update configuration" };
  }
});

export default router;
