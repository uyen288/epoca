import { TABLE_NAMES, type EntityMap, type RepositoryData, type TableName } from '../models'
import type { LocalRepository } from '../repository'

const DATABASE_NAME = 'epoca-local'
const DATABASE_VERSION = 1

export class IndexedDbRepository implements LocalRepository {
  private database?: Promise<IDBDatabase>

  private open(): Promise<IDBDatabase> {
    if (!('indexedDB' in globalThis)) {
      return Promise.reject(new Error('Trình duyệt này không hỗ trợ IndexedDB.'))
    }
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        for (const table of TABLE_NAMES) {
          if (!database.objectStoreNames.contains(table)) {
            database.createObjectStore(table, { keyPath: 'id' })
          }
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Không mở được cơ sở dữ liệu.'))
      request.onblocked = () => reject(new Error('Cơ sở dữ liệu đang được dùng ở cửa sổ khác.'))
    })
    return this.database
  }

  async getAll<K extends TableName>(table: K): Promise<EntityMap[K][]> {
    const database = await this.open()
    return requestResult(database.transaction(table, 'readonly').objectStore(table).getAll())
  }

  async put<K extends TableName>(table: K, record: EntityMap[K]): Promise<void> {
    const database = await this.open()
    await requestResult(database.transaction(table, 'readwrite').objectStore(table).put(record))
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const database = await this.open()
    await requestResult(database.transaction(table, 'readwrite').objectStore(table).delete(id))
  }

  async replaceAll(data: RepositoryData): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(TABLE_NAMES, 'readwrite')
    for (const table of TABLE_NAMES) {
      const store = transaction.objectStore(table)
      store.clear()
      for (const record of data[table] as EntityMap[typeof table][]) store.put(record)
    }
    await transactionComplete(transaction)
  }

  async clear(): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(TABLE_NAMES, 'readwrite')
    for (const table of TABLE_NAMES) transaction.objectStore(table).clear()
    await transactionComplete(transaction)
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể lưu dữ liệu.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error ?? new Error('Giao dịch dữ liệu không thành công.'))
  })
}
