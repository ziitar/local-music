import postgres from "postgres";
// import { join } from "@std/path";

const host = Deno.env.get("SQL_HOST") || "localhost";
const port = parseInt(Deno.env.get("SQL_PORT") || "5432");
const user = Deno.env.get("SQL_USER") || "ziitar";
const password = Deno.env.get("SQL_PASSWORD");
const database = Deno.env.get("SQL_DATABASE") || "localmusic";


export const sql = postgres({
  host,
  port,
  username: user,
  password,
  database,
  transform: {
    undefined: null,
  },
});
// try {
//   await sql.unsafe(
//     Deno.readTextFileSync(
//       join(import.meta.dirname || "", "../../dbs", "schema.sql"),
//     ),
//   );
// } catch (error) {
//   console.error("Error executing schema.sql:", error);
// }

export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}
