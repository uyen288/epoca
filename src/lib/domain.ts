import type {
  AppSettings,
  BackupData,
  CalendarEvent,
  EpocaBackup,
  JournalEntry,
  Task,
  TaskStatus,
} from '../data/models'
import { DEFAULT_SETTINGS, TABLE_NAMES } from '../data/models'

export function createId(): string {
  return crypto.randomUUID()
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toLocalInputValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function fromLocalInputValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function validateTaskSchedule(startAt: string | null, endAt: string | null): void {
  if (startAt !== null && typeof startAt !== 'string') throw new Error('Thời gian bắt đầu không hợp lệ.')
  if (endAt !== null && typeof endAt !== 'string') throw new Error('Thời gian kết thúc không hợp lệ.')
  if (startAt && Number.isNaN(Date.parse(startAt))) throw new Error('Thời gian bắt đầu không hợp lệ.')
  if (endAt && Number.isNaN(Date.parse(endAt))) throw new Error('Thời gian kết thúc không hợp lệ.')
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.')
  }
}

export function validateTask(task: Task): void {
  if (!isObject(task) || typeof task.id !== 'string' || !task.id || typeof task.title !== 'string' || !task.title.trim()) {
    throw new Error('Công việc cần có ID và tiêu đề hợp lệ.')
  }
  if (!['todo', 'in_progress', 'waiting', 'done'].includes(task.status)) throw new Error('Trạng thái công việc không hợp lệ.')
  if (!['none', 'low', 'medium', 'high'].includes(task.priority)) throw new Error('Mức ưu tiên không hợp lệ.')
  if (typeof task.description !== 'string' || typeof task.showInCalendar !== 'boolean' || !Array.isArray(task.labelIds)) {
    throw new Error('Thông tin công việc không hợp lệ.')
  }
  if (task.dueAt && Number.isNaN(Date.parse(task.dueAt))) throw new Error('Hạn chót không hợp lệ.')
  validateTaskSchedule(task.startAt, task.endAt)
  if ((task.status === 'done') !== Boolean(task.completedAt)) {
    throw new Error('Trạng thái hoàn thành và thời điểm hoàn thành không khớp.')
  }
  if (task.completedAt && Number.isNaN(Date.parse(task.completedAt))) throw new Error('Thời điểm hoàn thành không hợp lệ.')
}

export function validateEvent(event: CalendarEvent): void {
  if (!isObject(event) || typeof event.id !== 'string' || !event.id || typeof event.title !== 'string' || !event.title.trim()) {
    throw new Error('Sự kiện cần có ID và tên hợp lệ.')
  }
  if (typeof event.description !== 'string' || typeof event.allDay !== 'boolean') throw new Error('Thông tin sự kiện không hợp lệ.')
  if (!event.startAt || Number.isNaN(Date.parse(event.startAt))) {
    throw new Error('Vui lòng chọn thời gian bắt đầu hợp lệ.')
  }
  validateTaskSchedule(event.startAt, event.endAt)
  if (event.reminderMinutes !== null && (!Number.isFinite(event.reminderMinutes) || event.reminderMinutes < 0)) {
    throw new Error('Thời gian nhắc sự kiện không hợp lệ.')
  }
}

export function withTaskStatus(task: Task, status: TaskStatus, now = new Date().toISOString()): Task {
  return { ...task, status, completedAt: status === 'done' ? task.completedAt ?? now : null, updatedAt: now }
}

export function journalStreak(entries: JournalEntry[], now = new Date()): number {
  const savedDays = new Set(
    entries.filter((entry) => entry.title.trim() || entry.content.trim()).map((entry) => entry.entryDate),
  )
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!savedDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (savedDays.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function dailyActivityCounts(
  tasks: Task[],
  entries: JournalEntry[],
): Map<string, { journalEntries: number; completedTasks: number }> {
  const counts = new Map<string, { journalEntries: number; completedTasks: number }>()
  const getDay = (day: string) => {
    const count = counts.get(day) ?? { journalEntries: 0, completedTasks: 0 }
    counts.set(day, count)
    return count
  }

  for (const entry of entries) {
    if (entry.title.trim() || entry.content.trim()) getDay(entry.entryDate).journalEntries += 1
  }
  for (const task of tasks) {
    if (task.completedAt && !Number.isNaN(Date.parse(task.completedAt))) {
      getDay(localDateKey(new Date(task.completedAt))).completedTasks += 1
    }
  }
  return counts
}

export function createEmptyBackupData(): BackupData {
  return {
    tasks: [],
    labels: [],
    events: [],
    journalEntries: [],
    folders: [],
    notes: [],
    settings: DEFAULT_SETTINGS,
  }
}

export function validateBackup(value: unknown): EpocaBackup {
  if (!value || typeof value !== 'object') throw new Error('Tệp sao lưu không phải JSON época hợp lệ.')
  const backup = value as Partial<EpocaBackup>
  if (backup.app !== 'epoca') throw new Error('Đây không phải tệp sao lưu của época.')
  if (backup.backupVersion !== 1) throw new Error('Phiên bản tệp sao lưu không được hỗ trợ.')
  if (!backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) throw new Error('Tệp sao lưu thiếu dữ liệu.')

  const data = backup.data as Partial<BackupData>
  for (const table of TABLE_NAMES) {
    if (table === 'settings') continue
    if (!Array.isArray(data[table])) throw new Error(`Dữ liệu "${table}" không hợp lệ.`)
  }
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
    throw new Error('Cài đặt trong tệp sao lưu không hợp lệ.')
  }

  const labels = data.labels as BackupData['labels']
  const folders = data.folders as BackupData['folders']
  const events = data.events as BackupData['events']
  const journalEntries = data.journalEntries as BackupData['journalEntries']
  const notes = data.notes as BackupData['notes']
  assertUniqueIds(labels, 'nhãn')
  assertUniqueIds(folders, 'thư mục')
  assertUniqueIds(events, 'sự kiện')
  assertUniqueIds(journalEntries, 'nhật ký')
  assertUniqueIds(notes, 'ghi chú')
  for (const label of labels) {
    if (typeof label.name !== 'string' || !label.name.trim() || typeof label.color !== 'string') {
      throw new Error('Nhãn trong tệp sao lưu không hợp lệ.')
    }
  }
  for (const folder of folders) {
    if (typeof folder.name !== 'string' || !folder.name.trim()) throw new Error('Thư mục trong tệp sao lưu không hợp lệ.')
  }
  const labelIds = new Set(labels.map((label) => label.id))
  const folderIds = new Set(folders.map((folder) => folder.id))
  const taskIds = new Set<string>()
  for (const task of data.tasks as BackupData['tasks']) {
    if (!task.id || taskIds.has(task.id)) throw new Error('Tệp sao lưu có công việc thiếu hoặc trùng ID.')
    taskIds.add(task.id)
    validateTask(task)
    if (task.labelIds.some((id) => typeof id !== 'string' || !labelIds.has(id))) throw new Error('Một công việc tham chiếu nhãn không tồn tại.')
  }
  for (const event of events) validateEvent(event)
  for (const entry of journalEntries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate) || Number.isNaN(Date.parse(`${entry.entryDate}T12:00:00`))) {
      throw new Error('Ngày nhật ký trong tệp sao lưu không hợp lệ.')
    }
    if (typeof entry.title !== 'string' || typeof entry.content !== 'string' ||
      !['great', 'good', 'okay', 'low', 'rough', 'none'].includes(entry.mood) || typeof entry.promptId !== 'string') {
      throw new Error('Nội dung nhật ký trong tệp sao lưu không hợp lệ.')
    }
  }
  for (const note of notes) {
    if (typeof note.title !== 'string' || typeof note.content !== 'string' || typeof note.isPinned !== 'boolean') {
      throw new Error('Ghi chú trong tệp sao lưu không hợp lệ.')
    }
    if (note.folderId && !folderIds.has(note.folderId)) throw new Error('Một ghi chú tham chiếu thư mục không tồn tại.')
  }
  const days = journalEntries.map((entry) => entry.entryDate)
  if (new Set(days).size !== days.length) throw new Error('Tệp sao lưu có nhiều hơn một nhật ký trong cùng ngày.')

  const settings = data.settings as AppSettings
  if (!['light', 'dark', 'system'].includes(settings.theme) || ![0, 1].includes(settings.weekStartsOn) ||
    typeof settings.use24HourTime !== 'boolean' || !['month', 'week', 'day', 'agenda'].includes(settings.calendarView)) {
    throw new Error('Cài đặt trong tệp sao lưu không hợp lệ.')
  }
  return {
    app: 'epoca',
    backupVersion: 1,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : new Date().toISOString(),
    data: {
      tasks: data.tasks as BackupData['tasks'],
      labels,
      events,
      journalEntries,
      folders,
      notes,
      settings,
    },
  }
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  if (items.some((item) => !isObject(item) || typeof item.id !== 'string' || !item.id)) {
    throw new Error(`Tệp sao lưu có ${label} thiếu hoặc trùng ID.`)
  }
  const ids = items.map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Tệp sao lưu có ${label} thiếu hoặc trùng ID.`)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
