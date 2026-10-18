import type { AppSettings, BackupData, EpocaBackup } from './models'
import { localDateKey, validateBackup } from '../lib/domain'

export type BackupSource = {
  tasks: BackupData['tasks']
  labels: BackupData['labels']
  events: BackupData['events']
  journalEntries: BackupData['journalEntries']
  folders: BackupData['folders']
  notes: BackupData['notes']
  settings: AppSettings
}

export function createBackup(data: BackupSource): EpocaBackup {
  return {
    app: 'epoca',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      tasks: data.tasks,
      labels: data.labels,
      events: data.events,
      journalEntries: data.journalEntries,
      folders: data.folders,
      notes: data.notes,
      settings: data.settings,
    },
  }
}

export async function parseBackupFile(file: File): Promise<EpocaBackup> {
  if (!file.name.toLocaleLowerCase().endsWith('.json') && !['application/json', 'text/json'].includes(file.type)) {
    throw new Error('Chỉ hỗ trợ tệp sao lưu JSON.')
  }
  try {
    return validateBackup(JSON.parse(await file.text()) as unknown)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Tệp sao lưu không chứa JSON hợp lệ.', { cause: error })
    throw error
  }
}

export function downloadBackup(source: BackupSource): void {
  const backup = createBackup(source)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `epoca-backup-${localDateKey()}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
