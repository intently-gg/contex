import { Pool } from "pg"
import type { QueryResultRow } from "pg"
import { config } from "dotenv"

config()

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const host = process.env.DB_HOST || "localhost"
    const port = parseInt(process.env.DB_PORT || "5432", 10)
    const user = process.env.DB_USER || "postgres"
    const password = process.env.DB_PASSWORD || ""
    const database = process.env.DB_NAME || "contex"

    pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err)
    })
  }

  return pool
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 1
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return withRetry(operation, retries - 1)
    }
    throw error
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool()
  return withRetry(async () => {
    const result = await pool.query<T>(text, params)
    return result.rows
  })
}

export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

export async function testConnection(): Promise<boolean> {
  try {
    await query("SELECT 1")
    return true
  } catch (error) {
    console.error("Database connection test failed:", error)
    return false
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

