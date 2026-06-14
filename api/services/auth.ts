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

export async function registerUser(
  username: string,
  password: string,
): Promise<{ success: boolean; message: string; token?: string; user?: { id: number; username: string; role: string } }> {
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

    return { success: true, message: "User registered successfully", token, user };
  } catch (error) {
    console.error("Register error:", error);
    return { success: false, message: "Failed to register user" };
  }
}

export async function loginUser(
  username: string,
  password: string,
): Promise<
  {
    success: boolean;
    message: string;
    token?: string;
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

    return {
      success: true,
      message: "Login successful",
      token,
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
