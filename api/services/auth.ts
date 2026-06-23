import { sign, verify } from "jwt";
import { sql } from "../services/db.ts";
import { hashPassword, verifyPassword } from "../utils/password.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") ||
  "your-secret-key-change-in-production";

const encoder = new TextEncoder();
const key = encoder.encode(JWT_SECRET);

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: Date;
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
}

export function generateToken(payload: JWTPayload & { role?: string }): string {
  return sign({ ...payload, role: payload.role || 'user' }, key, { expiresIn: "2h" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = verify(token, key);
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// --- Refresh Token Functions ---

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function storeRefreshToken(
  userId: number,
  token: string,
  deviceInfo?: string,
  expiresAt?: Date,
): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
    VALUES (${userId}, ${tokenHash}, ${deviceInfo || null}, ${expiresAt || null})
  `;
}

export async function validateRefreshToken(
  token: string,
): Promise<{ userId: number; username: string; role: string } | null> {
  const tokenHash = await hashToken(token);
  const result = await sql`
    SELECT rt.user_id, u.username, u.role
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = ${tokenHash}
      AND rt.revoked_at IS NULL
      AND (rt.expires_at IS NULL OR rt.expires_at > NOW())
  `;
  if (result.length === 0) return null;
  return {
    userId: result[0].user_id,
    username: result[0].username,
    role: result[0].role,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
  `;
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: number,
  deviceInfo?: string,
  expiresAt?: Date,
): Promise<string> {
  await revokeRefreshToken(oldToken);
  const newToken = generateRefreshToken();
  await storeRefreshToken(userId, newToken, deviceInfo, expiresAt);
  return newToken;
}

export async function registerUser(
  username: string,
  password: string,
  isNative?: boolean,
): Promise<{ success: boolean; message: string; token?: string; refreshToken?: string; user?: { id: number; username: string; role: string } }> {
  if (!username || !password) {
    return { success: false, message: "Username and password are required" };
  }

  if (password.length < 6) {
    return {
      success: false,
      message: "Password must be at least 6 characters",
    };
  }

  try {
    const existing = await sql`
      SELECT id FROM users WHERE username = ${username}
    `;

    if (existing.length > 0) {
      return { success: false, message: "Username already exists" };
    }

    // Check if this is the first user (will be admin)
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    const isFirstUser = Number(userCount[0].count) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    const passwordHash = await hashPassword(password);

    const result = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${role})
      RETURNING id, username, role
    `;

    const user = result[0];
    const token = generateToken({ userId: user.id, username: user.username, role: user.role });

    const refreshToken = generateRefreshToken();
    const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await storeRefreshToken(user.id, refreshToken, isNative ? 'native' : 'web', expiresAt);

    return { success: true, message: "User registered successfully", token, refreshToken, user };
  } catch (error) {
    console.error("Register error:", error);
    return { success: false, message: "Failed to register user" };
  }
}

export async function loginUser(
  username: string,
  password: string,
  isNative?: boolean,
): Promise<
  {
    success: boolean;
    message: string;
    token?: string;
    refreshToken?: string;
    user?: { id: number; username: string; role: string };
  }
> {
  if (!username || !password) {
    return { success: false, message: "Username and password are required" };
  }

  try {
    const result = await sql`
      SELECT id, username, password_hash, role FROM users WHERE username = ${username}
    `;

    if (result.length === 0) {
      return { success: false, message: "Invalid username or password" };
    }

    const user = result[0];
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: "Invalid username or password" };
    }

    const token = generateToken({ userId: user.id, username: user.username, role: user.role });

    const refreshToken = generateRefreshToken();
    const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await storeRefreshToken(user.id, refreshToken, isNative ? 'native' : 'web', expiresAt);

    return {
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Failed to login" };
  }
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await sql`
    SELECT id, username, password_hash, role, created_at FROM users WHERE id = ${id}
  `;
  return result.length > 0 ? (result[0] as User) : null;
}

export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  if (!oldPassword || !newPassword) {
    return { success: false, message: "Old password and new password are required" };
  }

  if (newPassword.length < 6) {
    return { success: false, message: "New password must be at least 6 characters" };
  }

  if (oldPassword === newPassword) {
    return { success: false, message: "New password must be different from old password" };
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    const isValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
      return { success: false, message: "Old password is incorrect" };
    }

    const passwordHash = await hashPassword(newPassword);
    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;

    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, message: "Failed to change password" };
  }
}
