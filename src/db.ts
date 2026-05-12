import { Pool, QueryResultRow } from "pg";
import dotenv from "dotenv";
import logger from "./infrastructure/logger";

dotenv.config();

export type UploadStatus = "PENDING" | "CONFIRMED" | "DISMISSED";

export interface PendingUploadRow {
  uid: number;
  content_cid: string;               // CHAR(46) → llega como string
  metadata_cid: string;              // CHAR(46)
  extra_cids: unknown | null; // JSONB → lo puedes refinar luego
  status: UploadStatus;
  uploaded_at: string;       // pg normalmente lo da como string ISO
  purged: boolean;
}

export interface UploadUidRow { uid: number };

/**
 * Types for upload_sessions table
 */
export interface UploadSessionRow {
  uid: number
  creator_address: string
  started_at: string
  content_uris: unknown | null
}
export interface UploadSessionUidRow { uid: number }


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


export async function query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<{ rows: T[]}> {
  try {
    const result = await pool.query<T>(text, params)
    return { rows: result.rows };
  } catch (error) {
    logger.error({error}, 'error on db. Check if the DB is running')
    throw error
  }
}