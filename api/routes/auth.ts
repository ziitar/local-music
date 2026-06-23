import { Router } from "@oak/oak";
import {
  changePassword,
  generateToken,
  getUserById,
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  validateRefreshToken,
  verifyToken,
} from "../services/auth.ts";

const router = new Router();

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function isNativePlatform(ctx: { request: { headers: Headers } }): boolean {
  return ctx.request.headers.get("X-Platform") === "native";
}

function setRefreshCookie(ctx: { response: { headers: Headers } }, token: string): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  );
}

function clearRefreshCookie(ctx: { response: { headers: Headers } }): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0`,
  );
}

function getRefreshTokenFromCookie(ctx: { request: { headers: Headers } }): string | null {
  const cookie = ctx.request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

router.post("/api/auth/register", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;
  const isNative = isNativePlatform(ctx);

  const result = await registerUser(username, password, isNative);

  if (result.success && result.refreshToken) {
    if (isNative) {
      // Native: refreshToken already in response body
    } else {
      // Web: set httpOnly cookie, remove refreshToken from body
      setRefreshCookie(ctx, result.refreshToken);
      delete result.refreshToken;
    }
  }

  ctx.response.status = result.success ? 201 : 400;
  ctx.response.body = result;
});

router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;
  const isNative = isNativePlatform(ctx);

  const result = await loginUser(username, password, isNative);

  if (result.success && result.refreshToken) {
    if (isNative) {
      // Native: refreshToken already in response body
    } else {
      // Web: set httpOnly cookie, remove refreshToken from body
      setRefreshCookie(ctx, result.refreshToken);
      delete result.refreshToken;
    }
  }

  ctx.response.status = result.success ? 200 : 401;
  ctx.response.body = result;
});

router.get("/api/auth/me", async (ctx) => {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { message: "No token provided" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Invalid token" };
    return;
  }

  const user = await getUserById(payload.userId);

  if (!user) {
    ctx.response.status = 404;
    ctx.response.body = { message: "User not found" };
    return;
  }

  ctx.response.body = {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  };
});

router.put("/api/auth/password", async (ctx) => {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "No token provided" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "Invalid token" };
    return;
  }

  const body = await ctx.request.body.json();
  const { oldPassword, newPassword } = body;

  const result = await changePassword(payload.userId, oldPassword, newPassword);

  ctx.response.status = result.success ? 200 : 400;
  ctx.response.body = result;
});

router.post("/api/auth/refresh", async (ctx) => {
  const isNative = isNativePlatform(ctx);

  let refreshToken: string | null = null;
  if (isNative) {
    const body = await ctx.request.body.json();
    refreshToken = body.refreshToken;
  } else {
    refreshToken = getRefreshTokenFromCookie(ctx);
  }

  if (!refreshToken) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "No refresh token provided" };
    return;
  }

  const payload = await validateRefreshToken(refreshToken);
  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "Invalid or expired refresh token" };
    return;
  }

  const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const newRefreshToken = await rotateRefreshToken(
    refreshToken,
    payload.userId,
    isNative ? 'native' : 'web',
    expiresAt,
  );

  const accessToken = generateToken({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  });

  if (isNative) {
    ctx.response.body = { token: accessToken, refreshToken: newRefreshToken };
  } else {
    setRefreshCookie(ctx, newRefreshToken);
    ctx.response.body = { token: accessToken };
  }
});

router.post("/api/auth/logout", async (ctx) => {
  const isNative = isNativePlatform(ctx);

  let refreshToken: string | null = null;
  if (isNative) {
    const body = await ctx.request.body.json();
    refreshToken = body.refreshToken;
  } else {
    refreshToken = getRefreshTokenFromCookie(ctx);
  }

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  if (!isNative) {
    clearRefreshCookie(ctx);
  }

  ctx.response.body = { success: true };
});

export default router;
