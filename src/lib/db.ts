import Database from '@tauri-apps/plugin-sql'

const DB_PATH = 'sqlite:peak-tracker.db'

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load(DB_PATH)
  }
  return db
}
