import { describe, expect, it } from 'vitest'
import type { EpocaBackup, Task } from '../data/models'
import { DEFAULT_SETTINGS } from '../data/models'
import { createBackup, parseBackupFile } from '../data/backup'
import {
  dailyActivityCounts, journalStreak, localDateKey, validateBackup, validateEvent, validateTask,
  validateTaskSchedule, withTaskStatus,
} from './domain'

const task: Task = {
  id: 'task-1',
  title: 'Viết kế hoạch',
  description: '',
  status: 'todo',
  priority: 'medium',
  startAt: null,
  endAt: null,
  dueAt: null,
  showInCalendar: true,
  labelIds: ['label-1'],
  completedAt: null,
  createdAt: '2026-10-18T08:00:00.000Z',
  updatedAt: '2026-10-18T08:00:00.000Z',
  sortOrder: 0,
}

function backup(): EpocaBackup {
  return {
    app: 'epoca',
    backupVersion: 1,
    exportedAt: '2026-10-18T08:00:00.000Z',
    data: {
      tasks: [task],
      labels: [{ id: 'label-1', name: 'Cá nhân', color: '#6c9c8c', createdAt: task.createdAt, updatedAt: task.updatedAt }],
      events: [],
      journalEntries: [],
      folders: [{ id: 'folder-1', name: 'Ý tưởng', sortOrder: 0, createdAt: task.createdAt, updatedAt: task.updatedAt }],
      notes: [{ id: 'note-1', folderId: 'folder-1', title: 'Một ghi chú', content: '', isPinned: false, createdAt: task.createdAt, updatedAt: task.updatedAt }],
      settings: DEFAULT_SETTINGS,
    },
  }
}

describe('domain rules', () => {
  it('rejects end times at or before the start time', () => {
    expect(() => validateTaskSchedule('2026-10-18T10:00:00.000Z', '2026-10-18T10:00:00.000Z')).toThrow(/sau thời gian bắt đầu/)
    expect(() => validateTaskSchedule('2026-10-18T10:00:00.000Z', '2026-10-18T09:59:00.000Z')).toThrow(/sau thời gian bắt đầu/)
    expect(() => validateTaskSchedule('2026-10-18T10:00:00.000Z', '2026-10-18T10:01:00.000Z')).not.toThrow()
  })

  it('keeps completion timestamp and status in sync', () => {
    const completed = withTaskStatus(task, 'done', '2026-10-18T09:00:00.000Z')
    expect(completed.completedAt).toBe('2026-10-18T09:00:00.000Z')
    expect(() => validateTask(completed)).not.toThrow()
    const reopened = withTaskStatus(completed, 'todo', '2026-10-18T10:00:00.000Z')
    expect(reopened.completedAt).toBeNull()
    expect(() => validateTask(reopened)).not.toThrow()
  })

  it('requires an event title and a valid start time without creating a task', () => {
    expect(() => validateEvent({
      id: 'event-1', title: ' ', description: '', startAt: '2026-10-18T10:00:00.000Z',
      endAt: null, allDay: false, reminderMinutes: null, color: '#fff',
      createdAt: task.createdAt, updatedAt: task.updatedAt,
    })).toThrow(/tên hợp lệ/)
    const data = backup()
    data.data.events.push({
      id: 'event-1', title: 'Hẹn cà phê', description: '', startAt: '2026-10-18T10:00:00.000Z',
      endAt: null, allDay: false, reminderMinutes: 15, color: '#fff',
      createdAt: task.createdAt, updatedAt: task.updatedAt,
    })
    expect(validateBackup(data).data.tasks).toHaveLength(1)
    expect(validateBackup(data).data.events).toHaveLength(1)
  })

  it('counts saved non-empty journal days and starts from yesterday if today is empty', () => {
    const entries = [
      { id: '1', entryDate: '2026-10-18', title: '', content: 'ghi chép', mood: 'none' as const, promptId: 'p', createdAt: '', updatedAt: '' },
      { id: '2', entryDate: '2026-10-17', title: 'Một ngày', content: '', mood: 'good' as const, promptId: 'p', createdAt: '', updatedAt: '' },
      { id: '3', entryDate: '2026-10-16', title: '', content: ' ', mood: 'none' as const, promptId: 'p', createdAt: '', updatedAt: '' },
    ]
    expect(journalStreak(entries, new Date(2026, 9, 18, 12))).toBe(2)
    expect(journalStreak(entries.slice(1), new Date(2026, 9, 18, 12))).toBe(1)
    expect(localDateKey(new Date(2026, 0, 2))).toBe('2026-01-02')
  })

  it('groups saved journal entries and completed tasks by local date', () => {
    const completed = withTaskStatus(task, 'done', '2026-10-18T09:00:00.000Z')
    const activity = dailyActivityCounts([completed, task], [
      { id: 'entry', entryDate: '2026-10-18', title: '', content: 'Saved entry', mood: 'none', promptId: '', createdAt: '', updatedAt: '' },
      { id: 'empty', entryDate: '2026-10-17', title: ' ', content: '', mood: 'good', promptId: '', createdAt: '', updatedAt: '' },
    ])
    expect(activity.get('2026-10-18')).toEqual({ journalEntries: 1, completedTasks: 1 })
    expect(activity.has('2026-10-17')).toBe(false)
  })

  it('validates backup relationships before allowing restore', () => {
    const valid = backup()
    expect(validateBackup(valid)).toEqual(valid)
    expect(() => validateBackup({ ...valid, backupVersion: 2 })).toThrow(/không được hỗ trợ/)
    const missingLabel = backup()
    missingLabel.data.labels = []
    expect(() => validateBackup(missingLabel)).toThrow(/nhãn không tồn tại/)
    const missingFolder = backup()
    missingFolder.data.notes[0].folderId = 'deleted-folder'
    expect(() => validateBackup(missingFolder)).toThrow(/thư mục không tồn tại/)
    const duplicateJournal = backup()
    duplicateJournal.data.journalEntries = [
      { id: 'j1', entryDate: '2026-10-18', title: '', content: 'one', mood: 'none', promptId: 'p', createdAt: '', updatedAt: '' },
      { id: 'j2', entryDate: '2026-10-18', title: '', content: 'two', mood: 'none', promptId: 'p', createdAt: '', updatedAt: '' },
    ]
    expect(() => validateBackup(duplicateJournal)).toThrow(/cùng ngày/)
  })

  it('exports versioned JSON and imports it only from JSON files', async () => {
    const exported = createBackup(backup().data)
    const file = new File([JSON.stringify(exported)], 'epoca-backup.json', { type: 'application/json' })
    expect(await parseBackupFile(file)).toEqual(exported)
    const unsupported = new File(['{}'], 'notes.txt', { type: 'text/plain' })
    await expect(parseBackupFile(unsupported)).rejects.toThrow(/chỉ hỗ trợ tệp sao lưu JSON/i)
    const malformed = new File(['{'], 'backup.json', { type: 'application/json' })
    await expect(parseBackupFile(malformed)).rejects.toThrow(/JSON hợp lệ/)
  })
})
