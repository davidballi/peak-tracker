import Database from '@tauri-apps/plugin-sql'

const DB_PATH = 'sqlite:forge.db'

let dbPromise: Promise<Database> | null = null

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH)
  }
  return dbPromise
}

/**
 * Simple async mutex to prevent concurrent DB write operations.
 * The Tauri SQL plugin uses a connection pool, so concurrent
 * BEGIN TRANSACTION calls can land on different connections and deadlock.
 */
let writeLock: Promise<void> = Promise.resolve()

export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock
  let resolve: () => void
  writeLock = new Promise<void>((r) => { resolve = r })
  return prev.then(fn).finally(() => resolve!())
}
