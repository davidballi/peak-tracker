export default class Database {
  static async load(_path: string): Promise<Database> {
    return new Database()
  }
  async execute(_sql: string, _params?: unknown[]): Promise<void> {}
  async select<T>(_sql: string, _params?: unknown[]): Promise<T> {
    return [] as unknown as T
  }
}
