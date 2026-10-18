import type Database from '@tauri-apps/plugin-sql'
import { DEFAULT_SETTINGS, TABLE_NAMES, type EntityMap, type RepositoryData, type TableName } from '../models'
import type { LocalRepository } from '../repository'

const EMPTY_STATE: RepositoryData = {
  tasks: [],
  labels: [],
  events: [],
  journalEntries: [],
  folders: [],
  notes: [],
  settings: [],
}

export class TauriSqliteRepository implements LocalRepository {
  private database?: Promise<Database>
  private writeQueue: Promise<void> = Promise.resolve()

  private async open(): Promise<Database> {
    this.database ??= this.initialize()
    return this.database
  }

  private async initialize(): Promise<Database> {
    const { default: SqlDatabase } = await import('@tauri-apps/plugin-sql')
    const database = await SqlDatabase.load('sqlite:epoca.db')
    await database.execute('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)')
    await database.execute('INSERT OR IGNORE INTO app_state (id, data) VALUES (1, $1)', [JSON.stringify(EMPTY_STATE)])
    await database.execute('CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)')
    await database.execute('INSERT OR IGNORE INTO schema_meta (id, version) VALUES (1, 1)')
    return database
  }

  private async readState(): Promise<RepositoryData> {
    await this.writeQueue
    const database = await this.open()
    const [row] = await database.select<{ data: string }[]>('SELECT data FROM app_state WHERE id = 1')
    if (!row) return { ...EMPTY_STATE, settings: [DEFAULT_SETTINGS] }
    const value: unknown = JSON.parse(row.data)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Dữ liệu SQLite cục bộ không hợp lệ. Hãy khôi phục từ bản sao lưu.')
    }
    const state = value as Partial<RepositoryData>
    for (const table of TABLE_NAMES) {
      if (!Array.isArray(state[table])) throw new Error(`Dữ liệu SQLite của "${table}" không hợp lệ.`)
    }
    return state as RepositoryData
  }

  private mutate(update: (state: RepositoryData) => RepositoryData): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const database = await this.open()
      const [row] = await database.select<{ data: string }[]>('SELECT data FROM app_state WHERE id = 1')
      const current = row ? JSON.parse(row.data) as RepositoryData : EMPTY_STATE
      const next = update(current)
      await database.execute('UPDATE app_state SET data = $1 WHERE id = 1', [JSON.stringify(next)])
    })
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  async getAll<K extends TableName>(table: K): Promise<EntityMap[K][]> {
    const state = await this.readState()
    return state[table]
  }

  async put<K extends TableName>(table: K, record: EntityMap[K]): Promise<void> {
    await this.mutate((state) => {
      const records = state[table] as EntityMap[K][]
      const index = records.findIndex((item) => item.id === record.id)
      const updated = [...records]
      if (index < 0) updated.push(record)
      else updated[index] = record
      return { ...state, [table]: updated }
    })
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    await this.mutate((state) => ({
      ...state,
      [table]: (state[table] as EntityMap[K][]).filter((record) => record.id !== id),
    }))
  }

  async replaceAll(data: RepositoryData): Promise<void> {
    await this.mutate(() => data)
  }

  async clear(): Promise<void> {
    await this.mutate(() => EMPTY_STATE)
  }
}
