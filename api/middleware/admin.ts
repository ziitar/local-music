import { verifyToken, type JWTPayload } from "../services/auth.ts";

export interface ContextWithUser {
  state: {
    user?: JWTPayload;
  };
  request: {
    headers: {
      get: (name: string) => string | null;
    };
  };
  response: {
    status: number;
    body: any;
  };
}

/**
 * Middleware to require admin role for protected routes
 */
export async function requireAdmin(
  ctx: ContextWithUser,
  next: () => Promise<void>,
): Promise<void> {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Authentication required" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Invalid token" };
    return;
  }

  if (payload.role !== "admin") {
    ctx.response.status = 403;
    ctx.response.body = { message: "Admin access required" };
    return;
  }

  ctx.state.user = payload;
  await next();
}

/**
 * Middleware to require authentication (any logged-in user)
 */
export async function requireAuth(
  ctx: ContextWithUser,
  next: () => Promise<void>,
): Promise<void> {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Authentication required" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Invalid token" };
    return;
  }

  ctx.state.user = payload;
  await next();
}
