import type { EntityMap, RepositoryData, TableName } from './models'

export interface LocalRepository {
  getAll<K extends TableName>(table: K): Promise<EntityMap[K][]>
  put<K extends TableName>(table: K, record: EntityMap[K]): Promise<void>
  remove<K extends TableName>(table: K, id: string): Promise<void>
  replaceAll(data: RepositoryData): Promise<void>
  clear(): Promise<void>
}
