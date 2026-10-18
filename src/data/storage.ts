import { isTauri } from '@tauri-apps/api/core'
import { IndexedDbRepository } from './adapters/indexeddb'
import { TauriSqliteRepository } from './adapters/tauri-sqlite'
import type { LocalRepository } from './repository'

let repository: LocalRepository | undefined

export function getRepository(): LocalRepository {
  repository ??= isTauri() ? new TauriSqliteRepository() : new IndexedDbRepository()
  return repository
}

export const storageLocation = () =>
  isTauri() ? 'SQLite cục bộ trên thiết bị này' : 'IndexedDB cục bộ trong trình duyệt này'
