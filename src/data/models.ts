export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done'
export type Priority = 'none' | 'low' | 'medium' | 'high'
export type Mood = 'great' | 'good' | 'okay' | 'low' | 'rough' | 'none'
export type Theme = 'light' | 'dark' | 'system'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  startAt: string | null
  endAt: string | null
  dueAt: string | null
  showInCalendar: boolean
  labelIds: string[]
  completedAt: string | null
  createdAt: string
  updatedAt: string
  sortOrder: number
}

export interface Label {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  startAt: string
  endAt: string | null
  allDay: boolean
  reminderMinutes: number | null
  color: string
  createdAt: string
  updatedAt: string
}

export interface JournalEntry {
  id: string
  entryDate: string
  title: string
  content: string
  mood: Mood
  promptId: string
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  folderId: string | null
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: 'settings'
  theme: Theme
  weekStartsOn: 0 | 1
  use24HourTime: boolean
  calendarView: 'month' | 'week' | 'day' | 'agenda'
  schemaVersion: number
}

export interface EntityMap {
  tasks: Task
  labels: Label
  events: CalendarEvent
  journalEntries: JournalEntry
  folders: Folder
  notes: Note
  settings: AppSettings
}

export type TableName = keyof EntityMap

export interface BackupData {
  tasks: Task[]
  labels: Label[]
  events: CalendarEvent[]
  journalEntries: JournalEntry[]
  folders: Folder[]
  notes: Note[]
  settings: AppSettings
}

export type RepositoryData = { [K in TableName]: EntityMap[K][] }

export interface EpocaBackup {
  app: 'epoca'
  backupVersion: 1
  exportedAt: string
  data: BackupData
}

export const TABLE_NAMES: TableName[] = [
  'tasks',
  'labels',
  'events',
  'journalEntries',
  'folders',
  'notes',
  'settings',
]

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  theme: 'light',
  weekStartsOn: 1,
  use24HourTime: true,
  calendarView: 'month',
  schemaVersion: 1,
}

export const JOURNAL_PROMPTS = [
  { id: 'day-color', text: 'Hôm nay của bạn có màu gì?' },
  { id: 'smile', text: 'Điều gì khiến bạn mỉm cười hôm nay?' },
  { id: 'energy', text: 'Điều gì làm bạn tốn nhiều năng lượng nhất?' },
  { id: 'gratitude', text: 'Hôm nay bạn biết ơn điều gì?' },
  { id: 'tomorrow', text: 'Có điều gì bạn muốn làm khác đi vào ngày mai?' },
  { id: 'remember', text: 'Một điều nhỏ bạn muốn ghi nhớ là gì?' },
] as const

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  waiting: 'Đang chờ',
  done: 'Hoàn thành',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'Không ưu tiên',
  low: 'Thấp',
  medium: 'Vừa',
  high: 'Cao',
}

export const MOOD_OPTIONS: { id: Mood; label: string; symbol: string }[] = [
  { id: 'great', label: 'Tuyệt vời', symbol: '✦' },
  { id: 'good', label: 'Tốt', symbol: '☺' },
  { id: 'okay', label: 'Bình thường', symbol: '◡' },
  { id: 'low', label: 'Thấp', symbol: '☁' },
  { id: 'rough', label: 'Tệ', symbol: '☂' },
  { id: 'none', label: 'Không chọn', symbol: '·' },
]
