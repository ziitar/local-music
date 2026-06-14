import { Router } from "@oak/oak";
import {
  getUserById,
  loginUser,
  registerUser,
  verifyToken,
} from "../services/auth.ts";

const router = new Router();

router.post("/api/auth/register", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;

  const result = await registerUser(username, password);

  ctx.response.status = result.success ? 201 : 400;
  ctx.response.body = result;
});

router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;

  const result = await loginUser(username, password);

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

export default router;
