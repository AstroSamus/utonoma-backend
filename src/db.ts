import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});


export async function query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[]}> {
    const result = await pool.query<T>(text, params);
    return { rows: result.rows };
}