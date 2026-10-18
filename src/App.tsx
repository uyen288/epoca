import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, FileText,
  Folder, FolderPlus, LayoutDashboard, ListTodo, Menu, MoreHorizontal, NotebookPen,
  Plus, Search, Settings2, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import type {
  AppSettings, CalendarEvent, EpocaBackup, Folder as SpaceFolder,
  JournalEntry, Mood, Note, Priority, Task, TaskStatus,
} from './data/models'
import { downloadBackup, parseBackupFile } from './data/backup'
import {
  DEFAULT_SETTINGS, JOURNAL_PROMPTS, MOOD_OPTIONS, PRIORITY_LABELS, STATUS_LABELS,
} from './data/models'
import { getRepository, storageLocation } from './data/storage'
import {
  createId, dailyActivityCounts, fromLocalInputValue, journalStreak, localDateKey,
  toLocalInputValue, validateEvent, validateTask, withTaskStatus,
} from './lib/domain'
import logoMark from './assets/epoca-mark.png'
import './App.css'

type Page = 'dashboard' | 'todo' | 'kanban' | 'calendar' | 'journal' | 'spaces' | 'settings'
type CalendarRecord = { kind: 'task'; record: Task } | { kind: 'event'; record: CalendarEvent }

const NAV_ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'todo', label: 'Công việc', icon: ListTodo },
  { id: 'kanban', label: 'Bảng tiến độ', icon: ArrowDownUp },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays },
  { id: 'journal', label: 'Nhật ký', icon: BookOpen },
  { id: 'spaces', label: 'Không gian', icon: Folder },
]

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Tổng quan',
  todo: 'Công việc',
  kanban: 'Bảng tiến độ',
  calendar: 'Lịch của bạn',
  journal: 'Nhật ký',
  spaces: 'Không gian',
  settings: 'Cài đặt',
}

interface AppData {
  tasks: Task[]
  labels: import('./data/models').Label[]
  events: CalendarEvent[]
  journalEntries: JournalEntry[]
  folders: SpaceFolder[]
  notes: Note[]
  settings: AppSettings
}

const EMPTY_DATA: AppData = {
  tasks: [], labels: [], events: [], journalEntries: [], folders: [], notes: [],
  settings: DEFAULT_SETTINGS,
}

function App() {
  const [page, setPage] = useState<Page>(initialPage)
  const [todoPreset, setTodoPreset] = useState('all')
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CalendarRecord | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [calendarStart, setCalendarStart] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [clock, setClock] = useState<number | null>(null)
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([])
  const navigate = useCallback((next: Page) => {
    if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`)
    setPage(next)
  }, [])

  const refresh = useCallback(async () => {
    const repository = getRepository()
    const [tasks, labels, events, journalEntries, folders, notes, storedSettings] = await Promise.all([
      repository.getAll('tasks'), repository.getAll('labels'), repository.getAll('events'),
      repository.getAll('journalEntries'), repository.getAll('folders'), repository.getAll('notes'),
      repository.getAll('settings'),
    ])
    const settings = storedSettings[0] ?? DEFAULT_SETTINGS
    if (!storedSettings[0]) await repository.put('settings', settings)
    setData({ tasks, labels, events, journalEntries, folders, notes, settings })
    setLoadError('')
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => setLoadError(errorMessage(error)))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    const syncRoute = () => setPage(initialPage())
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme
  }, [data.settings.theme])

  useEffect(() => {
    const tick = () => setClock(Date.now())
    const initial = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, 30_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const run = useCallback(async (action: () => Promise<void>, success?: string): Promise<boolean> => {
    try {
      await action()
      await refresh()
      if (success) setNotice(success)
      return true
    } catch (error) {
      setNotice(errorMessage(error))
      return false
    }
  }, [refresh])

  const saveTask = (task: Task) => run(async () => {
    validateTask(task)
    await getRepository().put('tasks', task)
  }, 'Đã lưu công việc.')

  const saveEvent = (event: CalendarEvent) => run(async () => {
    validateEvent(event)
    await getRepository().put('events', event)
  }, 'Đã lưu sự kiện.')

  const deleteTask = (task: Task) => {
    if (!window.confirm(`Xóa công việc “${task.title}” khỏi mọi chế độ xem?`)) return
    void run(() => getRepository().remove('tasks', task.id), 'Đã xóa công việc.')
  }

  const openNewTask = (startAt?: string | null) => {
    setEditing(null)
    setCalendarStart(startAt ?? null)
    setDialogOpen(true)
  }

  const addLabel = async (name: string) => {
    const clean = name.trim()
    if (!clean) return
    const now = new Date().toISOString()
    await run(() => getRepository().put('labels', {
      id: createId(), name: clean, color: '#6c9c8c', createdAt: now, updatedAt: now,
    }), 'Đã tạo nhãn.')
  }

  const deleteLabel = async (label: AppData['labels'][number]) => {
    if (!window.confirm(`Xóa nhãn “${label.name}”? Công việc sẽ được giữ lại và bỏ liên kết nhãn.`)) return
    const now = new Date().toISOString()
    await run(() => getRepository().replaceAll({
      tasks: data.tasks.map((task) => task.labelIds.includes(label.id) ? { ...task, labelIds: task.labelIds.filter((id) => id !== label.id), updatedAt: now } : task),
      labels: data.labels.filter((item) => item.id !== label.id),
      events: data.events, journalEntries: data.journalEntries, folders: data.folders, notes: data.notes,
      settings: [data.settings],
    }), 'Đã xóa nhãn.')
  }

  const saveJournal = (entry: JournalEntry) => run(async () => {
    if (!entry.title.trim() && !entry.content.trim()) {
      if (entry.id) await getRepository().remove('journalEntries', entry.id)
      return
    }
    const repository = getRepository()
    const entries = await repository.getAll('journalEntries')
    const sameDay = entries.find((item) => item.entryDate === entry.entryDate)
    await repository.put('journalEntries', {
      ...entry, id: sameDay?.id ?? entry.id, createdAt: sameDay?.createdAt ?? entry.createdAt,
    })
  }, 'Nhật ký đã được lưu.')

  const createNote = async (folderId: string | null) => {
    const now = new Date().toISOString()
    const note: Note = {
      id: createId(), folderId, title: 'Ghi chú mới', content: '', isPinned: false,
      createdAt: now, updatedAt: now,
    }
    await run(() => getRepository().put('notes', note), 'Đã tạo ghi chú.')
    navigate('spaces')
    window.dispatchEvent(new CustomEvent('epoca:select-note', { detail: note.id }))
  }

  const saveNote = useCallback(async (note: Note) => {
    const saved = await run(() => getRepository().put('notes', note))
    if (!saved) throw new Error('Không thể lưu ghi chú. Nội dung vẫn được giữ trên màn hình.')
  }, [run])
  const saveSettings = useCallback((settings: AppSettings) => run(() => getRepository().put('settings', settings)), [run])
  const reminders = clock === null ? [] : data.events.filter((event) => {
    if (event.reminderMinutes === null) return false
    const reminderId = `${event.id}:${event.updatedAt}`
    const startTime = Date.parse(event.startAt)
    return !dismissedReminders.includes(reminderId) && clock >= startTime - event.reminderMinutes * 60_000 && clock <= startTime + 60_000
  })

  const pageContent = () => {
    if (loading) return <div className="loading-state"><span className="loader" />Đang mở không gian của bạn…</div>
    if (loadError) return (
      <div className="empty-state">
        <div className="empty-icon"><Circle size={22} /></div>
        <h2>Chưa thể mở dữ liệu</h2><p>{loadError}</p>
        <button className="button button-primary" onClick={() => { setLoading(true); void refresh().catch((e: unknown) => setLoadError(errorMessage(e))).finally(() => setLoading(false)) }}>Thử lại</button>
      </div>
    )
    switch (page) {
      case 'dashboard':
        return <DashboardView data={data} onNavigate={(next) => { if (next === 'todo') setTodoPreset('all'); navigate(next) }} onShowOverdue={() => { setTodoPreset('overdue'); navigate('todo') }} onCreateTask={() => openNewTask()} onCreateNote={() => { void createNote(null) }} />
      case 'todo':
        return <TodoView data={data} query={query} initialFilter={todoPreset} onEdit={(task) => { setEditing({ kind: 'task', record: task }); setDialogOpen(true) }} onCreate={() => openNewTask()} onToggle={(task) => void saveTask(withTaskStatus(task, task.status === 'done' ? 'todo' : 'done'))} onDelete={deleteTask} onAddLabel={addLabel} onDeleteLabel={deleteLabel} />
      case 'kanban':
        return <KanbanView data={data} onEdit={(task) => { setEditing({ kind: 'task', record: task }); setDialogOpen(true) }} onMove={(task, status, sortOrder) => void saveTask({ ...withTaskStatus(task, status), sortOrder: sortOrder ?? task.sortOrder })} onCreate={() => openNewTask()} />
      case 'calendar':
        return <CalendarView data={data} onEdit={(item) => { setEditing(item); setDialogOpen(true) }} onCreate={(startAt) => openNewTask(startAt)} onSettings={saveSettings} onMove={(item, startAt) => {
          if (item.kind === 'task') void saveTask({ ...item.record, startAt, endAt: item.record.endAt ? shiftedDate(item.record.endAt, item.record.startAt ?? startAt, startAt) : null, updatedAt: new Date().toISOString() })
          else void saveEvent({ ...item.record, startAt, endAt: item.record.endAt ? shiftedDate(item.record.endAt, item.record.startAt, startAt) : null, updatedAt: new Date().toISOString() })
        }} onDelete={(item) => {
          const title = item.record.title
          if (window.confirm(`Xóa ${item.kind === 'task' ? 'công việc' : 'sự kiện'} “${title}”?`)) {
            void run(() => getRepository().remove(item.kind === 'task' ? 'tasks' : 'events', item.record.id), 'Đã xóa.')
          }
        }} />
      case 'journal':
        return <JournalView entries={data.journalEntries} onSave={saveJournal} />
      case 'spaces':
        return <SpacesView data={data} query={query} onCreateNote={createNote} onSaveNote={saveNote} onCreateFolder={async (name) => {
          const now = new Date().toISOString()
          await run(() => getRepository().put('folders', { id: createId(), name, sortOrder: data.folders.length, createdAt: now, updatedAt: now }), 'Đã tạo thư mục.')
        }} onRenameFolder={async (folder) => {
          const name = window.prompt('Tên thư mục mới', folder.name)?.trim()
          if (name) await run(() => getRepository().put('folders', { ...folder, name, updatedAt: new Date().toISOString() }), 'Đã đổi tên thư mục.')
        }} onDeleteFolder={(folder) => {
          const count = data.notes.filter((note) => note.folderId === folder.id).length
          if (window.confirm(`Xóa thư mục “${folder.name}”${count ? ` cùng ${count} ghi chú bên trong` : ''}?`)) {
            void run(async () => {
              await getRepository().replaceAll({
                tasks: data.tasks, labels: data.labels, events: data.events, journalEntries: data.journalEntries,
                folders: data.folders.filter((item) => item.id !== folder.id),
                notes: data.notes.filter((item) => item.folderId !== folder.id),
                settings: [data.settings],
              })
            }, 'Đã xóa thư mục.')
          }
        }} onDeleteNote={(note) => {
          if (window.confirm(`Xóa ghi chú “${note.title}”?`)) void run(() => getRepository().remove('notes', note.id), 'Đã xóa ghi chú.')
        }} />
      case 'settings':
        return <SettingsView data={data} onSettings={saveSettings} onImport={(backup) => run(() => getRepository().replaceAll({
          ...backup.data, settings: [backup.data.settings],
        }), 'Đã khôi phục dữ liệu từ bản sao lưu.')} onClear={() => {
          if (window.confirm('Xóa toàn bộ công việc, lịch, nhật ký và ghi chú trên bản cài đặt này? Bạn nên xuất bản sao lưu trước.')) {
            void run(() => getRepository().clear(), 'Đã xóa dữ liệu cục bộ.')
          }
        }} />
    }
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#/dashboard" onClick={(event) => { event.preventDefault(); navigate('dashboard') }}>
          <img className="brand-mark" src={logoMark} alt="" /><span className="brand-word">época</span>
        </a>
        <div className="sidebar-caption">KHÔNG GIAN CỦA BẠN</div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => { navigate(id); setMobileNavOpen(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === 'todo' && data.tasks.some((task) => task.status !== 'done') && <span className="nav-count">{data.tasks.filter((task) => task.status !== 'done').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status"><span className="status-dot" /><span>{storageLocation()}</span></div>
          <button className={`nav-link ${page === 'settings' ? 'active' : ''}`} onClick={() => { navigate('settings'); setMobileNavOpen(false) }}><Settings2 size={18} /><span>Cài đặt & sao lưu</span></button>
          <div className="sidebar-tagline">everything at a glance<span>✳</span></div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Mở điều hướng" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>época</span><ChevronRight size={14} /><strong>{PAGE_TITLES[page]}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input aria-label="Tìm công việc và ghi chú" placeholder="Tìm kiếm…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
            <button className="button button-primary quick-add" onClick={() => openNewTask()}><Plus size={17} /><span>Tạo mới</span></button>
            <button className="avatar-button" aria-label="Mở nhật ký" onClick={() => navigate('journal')}>e</button>
          </div>
        </header>
        {reminders.length > 0 && <div className="reminder-strip">{reminders.map((event) => <div className="reminder-message" key={event.id}><Clock3 size={15} /><span><strong>Nhắc bạn:</strong> {event.title} · {formatDateTime(event.startAt, data.settings.use24HourTime)}</span><button className="text-button" onClick={() => navigate('calendar')}>Mở lịch</button><button className="icon-button" aria-label={`Ẩn lời nhắc ${event.title}`} onClick={() => setDismissedReminders((items) => [...items, `${event.id}:${event.updatedAt}`])}><X size={14} /></button></div>)}</div>}
        <div className="content-area">{pageContent()}</div>
      </main>
      {dialogOpen && <TaskDialog
        initial={editing}
        initialStartAt={calendarStart}
        labels={data.labels}
        onClose={() => { setDialogOpen(false); setEditing(null); setCalendarStart(null) }}
        onSaveTask={async (task) => { const saved = await saveTask(task); if (saved) { setDialogOpen(false); setEditing(null) } return saved }}
        onSaveEvent={async (event) => { const saved = await saveEvent(event); if (saved) { setDialogOpen(false); setEditing(null) } return saved }}
        onDelete={() => {
          if (!editing) return
          if (window.confirm(`Xóa “${editing.record.title}”?`)) {
            void run(() => getRepository().remove(editing.kind === 'task' ? 'tasks' : 'events', editing.record.id), 'Đã xóa.')
            setDialogOpen(false); setEditing(null)
          }
        }}
        onAddLabel={addLabel}
      />}
      {notice && <div className={`toast ${notice.toLowerCase().includes('không') || notice.toLowerCase().includes('lỗi') ? 'toast-error' : ''}`} role="status"><CheckCircle2 size={17} />{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}
    </div>
  )
}

function DashboardView({ data, onNavigate, onShowOverdue, onCreateTask, onCreateNote }: { data: AppData; onNavigate: (page: Page) => void; onShowOverdue: () => void; onCreateTask: () => void; onCreateNote: () => void }) {
  const today = localDateKey()
  const todayTasks = data.tasks.filter((task) => task.status !== 'done' && (isToday(task.dueAt, today) || isToday(task.startAt, today)))
  const overdue = data.tasks.filter((task) => task.status !== 'done' && task.dueAt && new Date(task.dueAt).getTime() < new Date().getTime())
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() - data.settings.weekStartsOn + 7) % 7))
  monday.setHours(0, 0, 0, 0)
  const completedThisWeek = data.tasks.filter((task) => task.completedAt && new Date(task.completedAt) >= monday)
  const upcoming = [
    ...data.tasks.filter((task) => task.status !== 'done' && task.showInCalendar && task.startAt).map((record) => ({ kind: 'task' as const, record, date: record.startAt! })),
    ...data.events.map((record) => ({ kind: 'event' as const, record, date: record.startAt })),
  ].filter((item) => new Date(item.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
  const streak = journalStreak(data.journalEntries)
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = localDateKey(date)
    return { date, count: data.tasks.filter((task) => task.completedAt && localDateKey(new Date(task.completedAt)) === key).length }
  })
  const maxChart = Math.max(1, ...lastSevenDays.map((day) => day.count))

  return (
    <div className="page-wrap dashboard-page">
      <div className="welcome-row">
        <div><p className="eyebrow">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><h1>Một ngày mới, <em>một nhịp riêng.</em></h1><p className="page-subtitle">Mọi điều quan trọng của bạn, ở ngay đây.</p></div>
        <button className="button button-primary" onClick={onCreateTask}><Plus size={17} />Thêm công việc</button>
      </div>
      <section className="dashboard-grid">
        <article className="panel today-panel">
          <div className="panel-heading"><div><span className="section-kicker">HÔM NAY</span><h2>Những điều cần làm</h2></div><button className="text-button" onClick={() => onNavigate('todo')}>Tất cả <ArrowUpRight size={15} /></button></div>
          <div className="metric-row"><strong>{todayTasks.length}</strong><span>việc đang chờ hôm nay</span>{overdue.length > 0 && <button className="overdue-pill" onClick={onShowOverdue}>{overdue.length} quá hạn</button>}</div>
          {todayTasks.length ? <div className="compact-task-list">{todayTasks.slice(0, 4).map((task) => <div className="compact-task" key={task.id}><Circle size={17} /><span>{task.title}</span><span className={`priority-dot priority-${task.priority}`} /></div>)}</div> : <div className="mini-empty"><span className="sun-symbol">☼</span><span>Lịch hôm nay đang rộng mở.</span></div>}
        </article>
        <article className="panel progress-panel">
          <div className="panel-heading"><div><span className="section-kicker">NHỊP TUẦN NÀY</span><h2>Tiến độ của bạn</h2></div><span className="panel-icon"><Sparkles size={17} /></span></div>
          <div className="week-total"><strong>{completedThisWeek.length}</strong><span>công việc hoàn thành</span></div>
          <div className="week-chart" aria-label="Số công việc hoàn thành từng ngày trong bảy ngày qua">{lastSevenDays.map((day) => <div className="chart-column" key={day.date.toISOString()}><span className="chart-bar" style={{ height: `${Math.max(4, day.count / maxChart * 70)}px` }} /><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'narrow' }).format(day.date)}</small></div>)}</div>
        </article>
        <article className="panel upcoming-panel">
          <div className="panel-heading"><div><span className="section-kicker">SẮP TỚI</span><h2>Trên lịch của bạn</h2></div><button className="icon-button" aria-label="Mở lịch" onClick={() => onNavigate('calendar')}><ArrowUpRight size={17} /></button></div>
          {upcoming.length ? <div className="upcoming-list">{upcoming.map(({ kind, record, date }) => <div className="upcoming-row" key={`${kind}-${record.id}`}><div className="upcoming-date"><strong>{new Date(date).getDate()}</strong><span>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(date))}</span></div><div className="upcoming-details"><span className={`type-label ${kind}`}>{kind === 'task' ? 'Công việc' : 'Sự kiện'}</span><strong>{record.title}</strong><small><Clock3 size={12} />{formatDateTime(date, data.settings.use24HourTime)}</small></div></div>)}</div> : <div className="mini-empty">Chưa có điều gì được lên lịch.</div>}
        </article>
        <article className="journal-streak-card">
          <div className="streak-summary">
            <span className="streak-flower">✳</span>
            <div><span className="section-kicker">STREAK NHẬT KÝ</span><div className="streak-number">{streak}<span> ngày liên tiếp</span></div><p>Chuỗi tính từ những ngày có nội dung đã lưu.</p></div>
            <button className="icon-button" aria-label="Mở nhật ký" onClick={() => onNavigate('journal')}><ArrowRight size={18} /></button>
          </div>
          <JournalActivityHeatmap tasks={data.tasks} entries={data.journalEntries} weekStartsOn={data.settings.weekStartsOn} />
        </article>
      </section>
      <div className="dashboard-quick-actions"><button onClick={onCreateTask}><Plus size={16} />Tạo công việc</button><button onClick={() => onNavigate('journal')}><NotebookPen size={16} />Viết nhật ký</button><button onClick={onCreateNote}><FileText size={16} />Ghi chú mới</button></div>
      <div className="dashboard-footnote"><span>✦</span> Hãy để hôm nay diễn ra theo cách của bạn.</div>
    </div>
  )
}

type HeatmapRange = 'week' | 'month' | 'year' | 'all'

function JournalActivityHeatmap({ tasks, entries, weekStartsOn }: {
  tasks: Task[]; entries: JournalEntry[]; weekStartsOn: 0 | 1
}) {
  const [range, setRange] = useState<HeatmapRange>('year')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = localDateKey(today)
  const activity = dailyActivityCounts(tasks, entries)
  const ranges: { id: HeatmapRange; label: string }[] = [
    { id: 'week', label: 'Tuần' }, { id: 'month', label: 'Tháng' },
    { id: 'year', label: 'Năm' }, { id: 'all', label: 'Tất cả' },
  ]
  const dayCount = range === 'week' ? 7 : range === 'month' ? 30 : 365
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - dayCount + 1)
  const startKey = localDateKey(startDate)
  const periodActivity = [...activity.entries()].filter(([day]) => day >= startKey && day <= todayKey)
  const totalActivities = periodActivity.reduce((total, [, counts]) => total + counts.journalEntries + counts.completedTasks, 0)
  const activeDays = periodActivity.length
  const levelFor = (count: number, monthly = false) => {
    if (!count) return 0
    if (monthly) return count >= 20 ? 4 : count >= 12 ? 3 : count >= 5 ? 2 : 1
    return count >= 6 ? 4 : count >= 4 ? 3 : count >= 2 ? 2 : 1
  }
  const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })

  const monthlyCells = (() => {
    const firstActivityDay = [...activity.keys()].filter((day) => day <= todayKey).sort()[0]
    const cursor = firstActivityDay
      ? new Date(Number(firstActivityDay.slice(0, 4)), Number(firstActivityDay.slice(5, 7)) - 1, 1)
      : new Date(today.getFullYear(), today.getMonth() - 11, 1)
    const months: { key: string; date: Date; count: number }[] = []
    while (cursor <= today) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      const count = [...activity.entries()].reduce((sum, [day, values]) =>
        day <= todayKey && day.startsWith(`${key}-`) ? sum + values.journalEntries + values.completedTasks : sum, 0)
      months.push({ key, date: new Date(cursor), count })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  })()
  const allTimeActivities = [...activity.entries()].filter(([day]) => day <= todayKey)
    .reduce((total, [, counts]) => total + counts.journalEntries + counts.completedTasks, 0)
  const allTimeActiveDays = [...activity.keys()].filter((day) => day <= todayKey).length

  const heatmapCells = (() => {
    const gridStart = new Date(startDate)
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() - weekStartsOn + 7) % 7))
    const gridEnd = new Date(today)
    gridEnd.setDate(gridEnd.getDate() + ((weekStartsOn + 6 - gridEnd.getDay() + 7) % 7))
    const cells: { key: string | null; date: Date; count: number; journals: number; tasks: number }[] = []
    const cursor = new Date(gridStart)
    while (cursor <= gridEnd) {
      const key = localDateKey(cursor)
      const counts = activity.get(key)
      cells.push({
        key: key <= todayKey && key >= startKey ? key : null,
        date: new Date(cursor),
        count: counts ? counts.journalEntries + counts.completedTasks : 0,
        journals: counts?.journalEntries ?? 0,
        tasks: counts?.completedTasks ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return cells
  })()
  const weekdayNames = weekStartsOn === 1
    ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const displayedActivities = range === 'all' ? allTimeActivities : totalActivities
  const displayedDays = range === 'all' ? allTimeActiveDays : activeDays

  return (
    <div className="streak-heatmap">
      <div className="heatmap-toolbar">
        <div className="heatmap-summary" aria-live="polite"><strong>{displayedActivities}</strong> hoạt động <span>·</span> {displayedDays} ngày có dấu chân</div>
        <div className="heatmap-tabs" role="tablist" aria-label="Khoảng thời gian dấu chân hoạt động">
          {ranges.map((item) => <button key={item.id} type="button" role="tab" aria-selected={range === item.id} className={range === item.id ? 'selected' : ''} onClick={() => setRange(item.id)}>{item.label}</button>)}
        </div>
      </div>
      {range === 'all' ? (
        <div className="activity-month-grid" aria-label="Hoạt động theo tháng">
          {monthlyCells.map(({ key, date, count }) => <div className="activity-month" key={key} title={`${new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date)}: ${count} hoạt động`}>
            <span>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date)}</span>
            <i className={`heatmap-cell activity-level-${levelFor(count, true)}`} />
          </div>)}
        </div>
      ) : (
        <div className="heatmap-scroll">
          <div className="heatmap-month-labels" style={{ gridTemplateColumns: `repeat(${heatmapCells.length / 7}, 11px)` }} aria-hidden="true">
            {heatmapCells.filter((cell) => cell.date.getDate() === 1 && cell.key)
              .map((cell) => <span key={cell.key} style={{ gridColumn: `${Math.floor(heatmapCells.indexOf(cell) / 7) + 1}` }}>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(cell.date)}</span>)}
          </div>
          <div className="heatmap-body">
            <div className="heatmap-weekdays" aria-hidden="true">
              {weekdayNames.map((day, index) => <span key={day} style={{ gridRow: index + 1 }}>{index % 2 === 0 ? day : ''}</span>)}
            </div>
            <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${heatmapCells.length / 7}, 11px)` }}>
              {heatmapCells.map((cell, index) => {
                const title = cell.key
                  ? `${dateFormat.format(cell.date)}: ${cell.count} hoạt động · ${cell.journals} trang nhật ký · ${cell.tasks} việc hoàn thành`
                  : ''
                return <span key={cell.key ?? `empty-${index}`} className={`heatmap-cell ${cell.key ? `activity-level-${levelFor(cell.count)}` : 'heatmap-cell-empty'}`} style={{ gridColumn: Math.floor(index / 7) + 1, gridRow: (index % 7) + 1 }} title={title} aria-label={title || undefined} />
              })}
            </div>
          </div>
        </div>
      )}
      <div className="heatmap-legend"><span>{range === 'all' ? 'Ít hoạt động' : 'Ít hơn'}</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heatmap-cell activity-level-${level}`} />)}<span>{range === 'all' ? 'Nhiều hoạt động' : 'Nhiều hơn'}</span></div>
    </div>
  )
}

function TodoView({ data, query, initialFilter, onEdit, onCreate, onToggle, onDelete, onAddLabel, onDeleteLabel }: {
  data: AppData; query: string; initialFilter: string; onEdit: (task: Task) => void; onCreate: () => void
  onToggle: (task: Task) => void; onDelete: (task: Task) => void
  onAddLabel: (name: string) => Promise<void>; onDeleteLabel: (label: AppData['labels'][number]) => Promise<void>
}) {
  const [filter, setFilter] = useState(initialFilter)
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [labelId, setLabelId] = useState('all')
  const [sort, setSort] = useState('manual')
  const [manageLabels, setManageLabels] = useState(false)
  const today = localDateKey()
  let tasks = data.tasks.filter((task) => {
    const matchesText = `${task.title} ${task.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'today' && task.status !== 'done' && (isToday(task.dueAt, today) || isToday(task.startAt, today))) ||
      (filter === 'upcoming' && Boolean(task.dueAt && task.dueAt.slice(0, 10) > today && task.status !== 'done')) ||
      (filter === 'overdue' && Boolean(task.dueAt && task.dueAt < new Date().toISOString() && task.status !== 'done')) ||
      (filter === 'done' && task.status === 'done')
    return matchesText && matchesFilter && (status === 'all' || task.status === status) &&
      (priority === 'all' || task.priority === priority) && (labelId === 'all' || task.labelIds.includes(labelId))
  })
  tasks = [...tasks].sort((a, b) => sort === 'due' ? (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') :
    sort === 'priority' ? ['high', 'medium', 'low', 'none'].indexOf(a.priority) - ['high', 'medium', 'low', 'none'].indexOf(b.priority) : a.sortOrder - b.sortOrder)
  const filters = [{ id: 'all', label: 'Tất cả' }, { id: 'today', label: 'Hôm nay' }, { id: 'upcoming', label: 'Sắp tới' }, { id: 'overdue', label: 'Quá hạn' }, { id: 'done', label: 'Đã xong' }]

  return (
    <div className="page-wrap">
      <div className="page-heading-row"><div><p className="eyebrow">MỌI VIỆC, ĐÚNG NHỊP</p><h1>Công việc</h1><p className="page-subtitle">Danh sách rõ ràng để bạn tập trung vào điều tiếp theo.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={17} />Thêm việc</button></div>
      <div className="filter-tabs">{filters.map((item) => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'all' && <span>{data.tasks.length}</span>}</button>)}</div>
      <div className="filters-row">
        <label><span>Trạng thái</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Tất cả</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Ưu tiên</span><select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">Tất cả</option>{Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Nhãn</span><select value={labelId} onChange={(e) => setLabelId(e.target.value)}><option value="all">Mọi nhãn</option>{data.labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
        <label className="sort-filter"><span>Sắp xếp</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="manual">Thứ tự thủ công</option><option value="due">Hạn chót</option><option value="priority">Ưu tiên</option></select></label>
        <button className="subtle-button" onClick={async () => {
          const name = window.prompt('Tên nhãn mới')
          if (name?.trim()) await onAddLabel(name)
        }}><Tag size={15} />Tạo nhãn</button>
        {!!data.labels.length && <button className="subtle-button" onClick={() => setManageLabels((open) => !open)}>{manageLabels ? 'Đóng nhãn' : 'Quản lý nhãn'}</button>}
      </div>
      {manageLabels && <div className="label-manager">{data.labels.map((label) => <span className="label-manager-item" key={label.id}><span className="label-chip">{label.name}</span><button aria-label={`Xóa nhãn ${label.name}`} onClick={() => void onDeleteLabel(label)}><X size={13} /></button></span>)}</div>}
      <div className="task-list-card">
        {!tasks.length ? <div className="empty-state compact"><div className="empty-icon"><ListTodo size={22} /></div><h2>{query ? 'Không tìm thấy kết quả' : 'Mọi thứ bắt đầu từ đây'}</h2><p>{query ? 'Thử từ khóa khác nhé.' : 'Thêm công việc đầu tiên để sắp xếp ngày của bạn.'}</p>{!query && <button className="button button-primary" onClick={onCreate}><Plus size={16} />Tạo công việc</button>}</div> : tasks.map((task) => (
          <article key={task.id} className={`task-row ${task.status === 'done' ? 'task-complete' : ''}`}>
            <button className="task-check" aria-label={task.status === 'done' ? 'Mở lại công việc' : 'Hoàn thành công việc'} onClick={() => onToggle(task)}>{task.status === 'done' ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button>
            <button className="task-main" onClick={() => onEdit(task)}><strong>{task.title}</strong><span>{task.description || (task.startAt ? `Lên lịch ${formatDateTime(task.startAt, data.settings.use24HourTime)}` : '')}</span></button>
            <span className={`priority-label priority-${task.priority}`}>{task.priority === 'none' ? '' : PRIORITY_LABELS[task.priority]}</span>
            <div className="task-labels">{task.labelIds.map((id) => data.labels.find((label) => label.id === id)).filter((label) => label).map((label) => <span key={label!.id} className="label-chip">{label!.name}</span>)}</div>
            {task.dueAt && <span className={`due-label ${task.status !== 'done' && task.dueAt < new Date().toISOString() ? 'due-overdue' : ''}`}><Clock3 size={13} />{formatDate(task.dueAt)}</span>}
            <button className="icon-button row-delete" aria-label={`Xóa ${task.title}`} onClick={() => onDelete(task)}><Trash2 size={15} /></button>
          </article>
        ))}
      </div>
      {data.tasks.length > 0 && <div className="list-footer">{tasks.length} / {data.tasks.length} công việc <span>•</span> Hoàn thành có thể mở lại bất cứ lúc nào.</div>}
    </div>
  )
}

function KanbanView({ data, onEdit, onMove, onCreate }: {
  data: AppData; onEdit: (task: Task) => void; onMove: (task: Task, status: TaskStatus, sortOrder?: number) => void; onCreate: () => void
}) {
  const columns: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'done']
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [labelFilter, setLabelFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  return (
    <div className="page-wrap kanban-page">
      <div className="page-heading-row"><div><p className="eyebrow">MỘT BỨC TRANH RÕ RÀNG</p><h1>Bảng tiến độ</h1><p className="page-subtitle">Di chuyển công việc để cập nhật trạng thái ở mọi nơi.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={17} />Thêm việc</button></div>
      <div className="filters-row kanban-filters"><label><span>Nhãn</span><select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}><option value="all">Mọi nhãn</option>{data.labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label><label><span>Ưu tiên</span><select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="all">Mọi mức độ</option>{Object.entries(PRIORITY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><span className="drag-hint">Kéo thẻ hoặc đổi trạng thái từ menu.</span></div>
      <div className="kanban-board">{columns.map((column) => {
        const tasks = data.tasks.filter((task) => task.status === column && (labelFilter === 'all' || task.labelIds.includes(labelFilter)) && (priorityFilter === 'all' || task.priority === priorityFilter)).sort((a, b) => a.sortOrder - b.sortOrder)
        return <section className="kanban-column" key={column} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
          e.preventDefault()
          const task = data.tasks.find((item) => item.id === (e.dataTransfer.getData('text/plain') || draggedId))
          if (task) onMove(task, column, Math.max(0, ...data.tasks.filter((item) => item.status === column && item.id !== task.id).map((item) => item.sortOrder)) + 1)
          setDraggedId(null)
        }}>
          <header><span className={`column-dot dot-${column}`} /><strong>{STATUS_LABELS[column]}</strong><span className="column-count">{tasks.length}</span>{column === 'todo' && <button className="icon-button" aria-label="Tạo công việc mới" onClick={onCreate}><Plus size={16} /></button>}</header>
          <div className="kanban-cards">{tasks.map((task) => <article draggable key={task.id} onDragStart={(e) => { setDraggedId(task.id); e.dataTransfer.setData('text/plain', task.id) }} onDragEnd={() => setDraggedId(null)} className={`kanban-card ${draggedId === task.id ? 'dragging' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
            e.preventDefault(); e.stopPropagation()
            const moving = data.tasks.find((item) => item.id === (e.dataTransfer.getData('text/plain') || draggedId))
            if (moving && moving.id !== task.id) onMove(moving, task.status, task.sortOrder - 0.5)
          }}>
            <button className="kanban-card-title" onClick={() => onEdit(task)}>{task.title}</button>
            {task.description && <p>{task.description}</p>}
            <div className="kanban-card-meta"><span className={`priority-label priority-${task.priority}`}>{task.priority === 'none' ? '—' : PRIORITY_LABELS[task.priority]}</span>{task.dueAt && <span><Clock3 size={12} />{formatDate(task.dueAt)}</span>}</div>
            <div className="kanban-card-footer">{task.labelIds.map((id) => data.labels.find((label) => label.id === id)).filter((label) => label).map((label) => <span className="label-chip" key={label!.id}>{label!.name}</span>)}<select aria-label={`Trạng thái ${task.title}`} value={task.status} onChange={(e) => onMove(task, e.target.value as TaskStatus)}>{columns.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></div>
          </article>)}</div>
        </section>
      })}</div>
    </div>
  )
}

function CalendarView({ data, onEdit, onCreate, onSettings, onMove, onDelete }: {
  data: AppData; onEdit: (item: CalendarRecord) => void; onCreate: (startAt: string) => void
  onSettings: (settings: AppSettings) => Promise<boolean>
  onMove: (item: CalendarRecord, startAt: string) => void; onDelete: (item: CalendarRecord) => void
}) {
  const [view, setView] = useState<AppSettings['calendarView']>(data.settings.calendarView)
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => localDateKey())
  const days = useMemo(() => {
    if (view === 'day') return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())]
    if (view === 'week') return Array.from({ length: 7 }, (_, index) => {
      const date = calendarWeekStart(anchor, data.settings.weekStartsOn); date.setDate(date.getDate() + index); return date
    })
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const weekStart = calendarWeekStart(first, data.settings.weekStartsOn)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(weekStart); date.setDate(weekStart.getDate() + index); return date
    })
  }, [anchor, data.settings.weekStartsOn, view])
  const calendarItems = useMemo<CalendarRecord[]>(() => [
    ...data.tasks.filter((task) => task.showInCalendar && task.startAt).map((record) => ({ kind: 'task' as const, record })),
    ...data.events.map((record) => ({ kind: 'event' as const, record })),
  ], [data.events, data.tasks])
  const itemsForDay = (key: string) => calendarItems.filter((item) => localDateKey(new Date(startAtOf(item))) === key)
  const shift = (step: number) => {
    const next = new Date(anchor)
    if (view === 'day') next.setDate(next.getDate() + step)
    else if (view === 'week') next.setDate(next.getDate() + step * 7)
    else next.setMonth(next.getMonth() + step)
    setAnchor(next)
  }
  const monthTitle = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(anchor)
  const acceptDrop = (event: React.DragEvent, date: Date) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    const item = calendarItems.find((candidate) => candidate.record.id === id)
    if (!item) return
    const old = new Date(startAtOf(item))
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), old.getHours(), old.getMinutes())
    onMove(item, target.toISOString())
  }
  const settingsView = (next: AppSettings['calendarView']) => {
    setView(next)
    void onSettings({ ...data.settings, calendarView: next })
  }
  const agenda = [
    ...calendarItems.map((item) => ({ item, at: startAtOf(item), deadline: false })),
    ...data.tasks.filter((task) => task.status !== 'done' && !task.startAt && task.dueAt).map((record) => ({
      item: { kind: 'task' as const, record }, at: record.dueAt!, deadline: true,
    })),
  ].filter((entry) => new Date(entry.at) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="page-wrap calendar-page">
      <div className="page-heading-row"><div><p className="eyebrow">THỜI GIAN CỦA BẠN</p><h1>Lịch của bạn</h1><p className="page-subtitle">Công việc đã lên lịch và những sự kiện riêng biệt.</p></div><button className="button button-primary" onClick={() => onCreate(new Date().toISOString())}><Plus size={17} />Tạo lịch</button></div>
      <div className="calendar-toolbar"><div className="calendar-month-nav"><button className="icon-button" aria-label="Khoảng trước" onClick={() => shift(-1)}><ChevronLeft size={18} /></button><button className="today-button" onClick={() => { setAnchor(new Date()); setSelected(localDateKey()) }}>Hôm nay</button><button className="icon-button" aria-label="Khoảng sau" onClick={() => shift(1)}><ChevronRight size={18} /></button><h2>{view === 'agenda' ? 'Sắp tới' : view === 'day' ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(anchor) : monthTitle}</h2></div><div className="segmented">{(['month', 'week', 'day', 'agenda'] as const).map((item) => <button key={item} className={view === item ? 'selected' : ''} onClick={() => settingsView(item)}>{({ month: 'Tháng', week: 'Tuần', day: 'Ngày', agenda: 'Sắp tới' })[item]}</button>)}</div></div>
      {view === 'agenda' ? <div className="agenda-list">{agenda.length ? agenda.map(({ item, at, deadline }) => <CalendarAgendaItem key={`${item.kind}-${item.record.id}-${deadline}`} item={item} at={at} deadline={deadline} use24HourTime={data.settings.use24HourTime} onEdit={onEdit} onDelete={onDelete} />) : <div className="empty-state compact"><div className="empty-icon"><CalendarDays size={22} /></div><h2>Chưa có lịch sắp tới</h2><p>Các task đã lên lịch và sự kiện sẽ xuất hiện ở đây.</p></div>}</div> :
        <div className={`calendar-grid calendar-${view}`}>
          {view === 'month' && (data.settings.weekStartsOn === 1 ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']).map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {days.map((date) => {
            const key = localDateKey(date)
            const items = itemsForDay(key)
            return <div key={key} className={`calendar-day ${view === 'month' && date.getMonth() !== anchor.getMonth() ? 'outside-month' : ''} ${key === localDateKey() ? 'is-today' : ''} ${selected === key ? 'is-selected' : ''}`} onClick={() => { setSelected(key); onCreate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9).toISOString()) }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => acceptDrop(e, date)}>
              <button className="day-number" onClick={(e) => { e.stopPropagation(); setSelected(key) }}>{date.getDate()}</button>
              <div className="day-events">{items.slice(0, view === 'month' ? 3 : 8).map((item) => <CalendarBlock key={`${item.kind}-${item.record.id}`} item={item} use24HourTime={data.settings.use24HourTime} onEdit={onEdit} onDelete={onDelete} />)}{items.length > 3 && view === 'month' && <span className="more-events">+{items.length - 3} nữa</span>}</div>
              <button className="add-day-button" aria-label={`Tạo lịch ngày ${key}`} onClick={(e) => { e.stopPropagation(); onCreate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9).toISOString()) }}><Plus size={14} /></button>
            </div>
          })}
        </div>}
      <div className="calendar-legend"><span><i className="legend-task" /> Công việc</span><span><i className="legend-event" /> Sự kiện</span><span>Kéo lịch sang ngày khác để đổi thời gian.</span></div>
    </div>
  )
}

function CalendarBlock({ item, use24HourTime, onEdit, onDelete }: { item: CalendarRecord; use24HourTime: boolean; onEdit: (item: CalendarRecord) => void; onDelete: (item: CalendarRecord) => void }) {
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: use24HourTime ? 'h23' : 'h12' }).format(new Date(startAtOf(item)))
  return <button draggable className={`calendar-event-block ${item.kind}`} onDragStart={(e) => e.dataTransfer.setData('text/plain', item.record.id)} onClick={(e) => { e.stopPropagation(); onEdit(item) }} onContextMenu={(e) => { e.preventDefault(); onDelete(item) }} title={`${item.kind === 'task' ? 'Công việc' : 'Sự kiện'}: ${item.record.title}. Nhấp phải để xóa.`}><span>{item.kind === 'task' ? <Check size={11} /> : <CalendarDays size={11} />}</span>{time && <small>{time}</small>}{item.record.title}</button>
}

function CalendarAgendaItem({ item, at, deadline, use24HourTime, onEdit, onDelete }: { item: CalendarRecord; at: string; deadline: boolean; use24HourTime: boolean; onEdit: (item: CalendarRecord) => void; onDelete: (item: CalendarRecord) => void }) {
  return <div className="agenda-row"><div className="agenda-date">{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at))}</div><div className={`agenda-marker ${item.kind}`} /><button className="agenda-title" onClick={() => onEdit(item)}><span>{deadline ? 'Hạn chót' : item.kind === 'task' ? 'Công việc' : 'Sự kiện'}</span><strong>{item.record.title}</strong></button><span className="agenda-time">{item.kind === 'event' && item.record.allDay ? 'Cả ngày' : formatDateTime(at, use24HourTime)}</span><button className="icon-button" aria-label={`Xóa ${item.record.title}`} onClick={() => onDelete(item)}><Trash2 size={15} /></button></div>
}

function JournalView({ entries, onSave }: { entries: JournalEntry[]; onSave: (entry: JournalEntry) => Promise<boolean> }) {
  const [day, setDay] = useState(localDateKey())
  const existing = entries.find((entry) => entry.entryDate === day)
  const streak = journalStreak(entries)
  const recent = [...entries].sort((a, b) => b.entryDate.localeCompare(a.entryDate))
  return (
    <div className="page-wrap journal-page">
      <div className="page-heading-row"><div><p className="eyebrow">MỘT KHOẢNG LẶNG CHO RIÊNG MÌNH</p><h1>Nhật ký</h1><p className="page-subtitle">Ghi lại những điều bạn muốn mang theo.</p></div><div className="streak-badge"><span>✳</span><strong>{streak}</strong><small>ngày liên tiếp</small></div></div>
      <div className="journal-layout">
        <JournalEditor key={day} day={day} existing={existing} onSave={onSave} onDayChange={setDay} />
        <aside className="journal-history panel"><div className="panel-heading"><div><span className="section-kicker">NHỮNG TRANG ĐÃ QUA</span><h2>Gần đây</h2></div><NotebookPen size={18} /></div>
          {recent.length ? <div className="journal-entry-list">{recent.map((entry) => <button key={entry.id} className={`journal-entry-preview ${day === entry.entryDate ? 'active' : ''}`} onClick={() => setDay(entry.entryDate)}><span>{new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', weekday: 'short' }).format(new Date(`${entry.entryDate}T12:00:00`))}</span><strong>{entry.title || entry.content.slice(0, 46) || 'Một trang nhật ký'}</strong><small>{MOOD_OPTIONS.find((item) => item.id === entry.mood)?.symbol} {entry.content ? `${entry.content.slice(0, 70)}${entry.content.length > 70 ? '…' : ''}` : 'Chưa có nội dung'}</small></button>)}</div> : <div className="history-empty"><BookOpen size={20} /><p>Những trang bạn lưu sẽ xuất hiện tại đây.</p></div>}
          <div className="streak-note"><span>✳</span><p>Chuỗi chỉ tính ngày có tiêu đề hoặc nội dung nhật ký đã lưu. Chọn tâm trạng thôi thì chưa tính nhé.</p></div>
        </aside>
      </div>
    </div>
  )
}

function JournalEditor({ day, existing, onSave, onDayChange }: { day: string; existing?: JournalEntry; onSave: (entry: JournalEntry) => Promise<boolean>; onDayChange: (day: string) => void }) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  const [mood, setMood] = useState<Mood>(existing?.mood ?? 'none')
  const [promptId, setPromptId] = useState<string>(existing?.promptId || JOURNAL_PROMPTS[0].id)
  const [saved, setSaved] = useState(false)
  const prompt = JOURNAL_PROMPTS.find((item) => item.id === promptId) ?? JOURNAL_PROMPTS[0]
  const choosePrompt = () => {
    const options = JOURNAL_PROMPTS.filter((item) => item.id !== promptId)
    setPromptId(options[Math.floor(Math.random() * options.length)].id)
    setSaved(false)
  }
  const submit = async () => {
    const now = new Date().toISOString()
    const entry: JournalEntry = { id: existing?.id ?? createId(), entryDate: day, title: title.trim(), content: content.trim(), mood, promptId, createdAt: existing?.createdAt ?? now, updatedAt: now }
    setSaved(await onSave(entry))
  }
  const deleteEntry = () => {
    if (!existing || !window.confirm('Xóa bài nhật ký của ngày này?')) return
    void onSave({ ...existing, title: '', content: '', updatedAt: new Date().toISOString() })
  }
  return <section className="journal-editor paper-panel">
          <div className="journal-date-row"><label className="date-picker"><CalendarDays size={17} /><input aria-label="Ngày nhật ký" type="date" value={day} onChange={(e) => onDayChange(e.target.value)} /></label><span>{existing ? 'Đã có ghi chép' : 'Một trang mới'}</span></div>
          <input className="journal-title" aria-label="Tiêu đề nhật ký" placeholder="Một ngày của bạn…" value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false) }} />
          <div className="mood-selector"><span>Hôm nay bạn cảm thấy thế nào?</span><div>{MOOD_OPTIONS.map((option) => <button key={option.id} className={mood === option.id ? 'selected' : ''} onClick={() => { setMood(option.id); setSaved(false) }}><b>{option.symbol}</b><span>{option.label}</span></button>)}</div></div>
          <div className="journal-prompt"><span className="prompt-icon">✳</span><div><small>MỘT CÂU HỎI NHẸ NHÀNG</small><p>{prompt.text}</p></div><button className="icon-button" aria-label="Đổi câu hỏi gợi ý" onClick={choosePrompt}><ArrowDownUp size={16} /></button></div>
          <textarea className="journal-writing" aria-label="Nội dung nhật ký" placeholder="Hãy viết theo cách của bạn…" value={content} onChange={(e) => { setContent(e.target.value); setSaved(false) }} />
          <div className="journal-editor-footer"><span>{saved ? '✓ Đã lưu trên thiết bị này' : 'Nội dung chỉ lưu trên thiết bị này'}</span><div>{existing && <button className="subtle-button danger-text" onClick={deleteEntry}><Trash2 size={15} />Xóa</button>}<button className="button button-primary" onClick={() => void submit()}><Check size={16} />Lưu trang viết</button></div></div>
        </section>
}

function SpacesView({ data, query, onCreateNote, onSaveNote, onCreateFolder, onRenameFolder, onDeleteFolder, onDeleteNote }: {
  data: AppData; query: string; onCreateNote: (folderId: string | null) => void
  onSaveNote: (note: Note) => Promise<void>; onCreateFolder: (name: string) => Promise<void>
  onRenameFolder: (folder: SpaceFolder) => void; onDeleteFolder: (folder: SpaceFolder) => void; onDeleteNote: (note: Note) => void
}) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Note | null>(null)
  const [saveState, setSaveState] = useState('Đã lưu')
  const [sort, setSort] = useState<'recent' | 'title' | 'pinned'>('recent')
  useEffect(() => {
    const listener = (event: Event) => setNoteId((event as CustomEvent<string>).detail)
    window.addEventListener('epoca:select-note', listener)
    return () => window.removeEventListener('epoca:select-note', listener)
  }, [])
  const visibleNotes = data.notes.filter((note) => (folderId === null || note.folderId === folderId) &&
    `${note.title} ${note.content}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'pinned' ? Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt) : Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt))
  const selected = data.notes.find((note) => note.id === noteId) ?? visibleNotes[0] ?? null
  useEffect(() => {
    if (!draft) return
    const timer = window.setTimeout(() => {
      void onSaveNote({ ...draft, title: draft.title.trim() || 'Ghi chú mới', updatedAt: new Date().toISOString() })
        .then(() => setSaveState('Đã lưu'))
        .catch(() => setSaveState('Lỗi lưu · nội dung vẫn còn trên màn hình'))
    }, 750)
    return () => window.clearTimeout(timer)
  }, [draft, onSaveNote])
  const active = draft && selected?.id === draft.id ? draft : selected
  return (
    <div className="page-wrap spaces-page">
      <div className="page-heading-row"><div><p className="eyebrow">Ý TƯỞNG, GHI CHÚ, MỌI ĐIỀU RIÊNG TƯ</p><h1>Không gian</h1><p className="page-subtitle">Một góc nhỏ để lưu những điều bạn muốn nhớ.</p></div><button className="button button-primary" onClick={() => onCreateNote(folderId)}><Plus size={17} />Ghi chú mới</button></div>
      <div className="spaces-layout">
        <aside className="folder-panel"><div className="spaces-panel-heading"><span>THƯ MỤC</span><button className="icon-button" aria-label="Tạo thư mục" onClick={async () => {
          const name = window.prompt('Tên thư mục mới')?.trim()
          if (name) await onCreateFolder(name)
        }}><FolderPlus size={16} /></button></div>
          <button className={`folder-link ${folderId === null ? 'active' : ''}`} onClick={() => { setFolderId(null); setNoteId(null) }}><Folder size={16} />Chưa phân loại<span>{data.notes.filter((note) => !note.folderId).length}</span></button>
          {data.folders.map((folder) => <div className="folder-row" key={folder.id}><button className={`folder-link ${folderId === folder.id ? 'active' : ''}`} onClick={() => { setFolderId(folder.id); setNoteId(null) }}><Folder size={16} />{folder.name}<span>{data.notes.filter((note) => note.folderId === folder.id).length}</span></button><button className="folder-more" aria-label={`Tùy chọn ${folder.name}`} onClick={() => {
            const option = window.prompt('Nhập 1 để đổi tên, 2 để xóa thư mục')
            if (option === '1') onRenameFolder(folder)
            if (option === '2') onDeleteFolder(folder)
          }}><MoreHorizontal size={15} /></button></div>)}
          {!data.folders.length && <p className="folder-empty">Tạo thư mục để sắp xếp ghi chú.</p>}
        </aside>
        <section className="notes-panel"><div className="spaces-panel-heading"><span>GHI CHÚ <small>{visibleNotes.length}</small></span><select aria-label="Sắp xếp ghi chú" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="recent">Mới cập nhật</option><option value="title">Tên ghi chú</option><option value="pinned">Ghim lên trước</option></select></div>
          {visibleNotes.length ? visibleNotes.map((note) => <button key={note.id} className={`note-list-item ${active?.id === note.id ? 'active' : ''}`} onClick={() => { setNoteId(note.id); setDraft(note) }}><span className="note-title-line">{note.isPinned && <span className="pin-indicator">✦</span>}{note.title}</span><span>{note.content || 'Chưa có nội dung'}</span><small>{formatDate(note.updatedAt)}</small></button>) : <div className="notes-empty"><FileText size={21} /><strong>{query ? 'Không tìm thấy ghi chú' : 'Chưa có ghi chú nào'}</strong>{!query && <button className="text-button" onClick={() => onCreateNote(folderId)}>Tạo ghi chú đầu tiên <ArrowRight size={14} /></button>}</div>}
        </section>
        <section className="note-editor">{active ? <><div className="note-editor-toolbar"><span>{saveState}</span><div><button className="icon-button" aria-label={active.isPinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú'} onClick={() => setDraft({ ...active, isPinned: !active.isPinned })}>{active.isPinned ? '✦' : '☆'}</button><select aria-label="Di chuyển ghi chú" value={active.folderId ?? ''} onChange={(e) => setDraft({ ...active, folderId: e.target.value || null })}><option value="">Chưa phân loại</option>{data.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button className="icon-button danger-text" aria-label="Xóa ghi chú" onClick={() => onDeleteNote(active)}><Trash2 size={15} /></button></div></div><input className="note-title-input" aria-label="Tiêu đề ghi chú" value={active.title} onChange={(e) => setDraft({ ...active, title: e.target.value })} /><textarea className="note-content-input" aria-label="Nội dung ghi chú" placeholder="Bắt đầu viết điều gì đó…" value={active.content} onChange={(e) => setDraft({ ...active, content: e.target.value })} /><div className="note-editor-foot">Tự động lưu · Markdown cơ bản được hỗ trợ</div></> : <div className="note-empty-editor"><FileText size={24} /><p>Chọn một ghi chú để đọc hoặc bắt đầu một trang mới.</p></div>}</section>
      </div>
    </div>
  )
}

function SettingsView({ data, onSettings, onImport, onClear }: {
  data: AppData; onSettings: (settings: AppSettings) => void
  onImport: (backup: EpocaBackup) => void; onClear: () => void
}) {
  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const backup = await parseBackupFile(file)
      if (!window.confirm('Thay thế toàn bộ dữ liệu hiện tại bằng bản sao lưu này? Không thể hoàn tác.')) return
      onImport(backup)
    } catch (error) {
      window.alert(errorMessage(error))
    }
  }
  return (
    <div className="page-wrap settings-page">
      <div className="page-heading-row"><div><p className="eyebrow">TÙY CHỈNH RIÊNG CỦA BẠN</p><h1>Cài đặt</h1><p className="page-subtitle">Quản lý trải nghiệm và giữ an toàn cho dữ liệu.</p></div></div>
      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Sparkles size={18} /></div><div><h2>Giao diện</h2><p>Chọn cách época hiện lên trong không gian của bạn.</p></div></div><div className="settings-control"><label htmlFor="theme-select">Chế độ màu</label><select id="theme-select" value={data.settings.theme} onChange={(e) => onSettings({ ...data.settings, theme: e.target.value as AppSettings['theme'] })}><option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option></select></div></section>
      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><CalendarDays size={18} /></div><div><h2>Lịch</h2><p>Chọn nhịp tuần và cách hiển thị thời gian.</p></div></div><div className="settings-options">      <label className="settings-control"><span>Ngày bắt đầu tuần</span><select value={data.settings.weekStartsOn} onChange={(e) => onSettings({ ...data.settings, weekStartsOn: Number(e.target.value) as 0 | 1 })}><option value={1}>Thứ Hai</option><option value={0}>Chủ Nhật</option></select></label><label className="toggle-setting"><input type="checkbox" checked={data.settings.use24HourTime} onChange={(e) => onSettings({ ...data.settings, use24HourTime: e.target.checked })} /><span>Hiển thị giờ theo định dạng 24 giờ</span></label></div></section>
      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><FileText size={18} /></div><div><h2>Dữ liệu & sao lưu</h2><p>{storageLocation()}. Web và desktop không tự đồng bộ.</p></div></div><div className="settings-control"><span>Dữ liệu của bạn</span><strong>{data.tasks.length} công việc · {data.events.length} sự kiện · {data.notes.length} ghi chú · {data.journalEntries.length} trang nhật ký</strong></div><div className="settings-actions"><button className="button button-secondary" onClick={() => downloadBackup(data)}><ArrowDownUp size={16} />Xuất bản sao lưu</button><label className="button button-secondary upload-button"><ArrowUpRight size={16} />Nhập bản sao lưu<input type="file" accept="application/json,.json" onChange={(e) => { void importBackup(e.target.files?.[0]); e.currentTarget.value = '' }} /></label><button className="button button-danger" onClick={onClear}><Trash2 size={15} />Xóa toàn bộ dữ liệu</button></div></section>
      <section className="privacy-note"><span>i</span><p>época lưu nội dung của bạn cục bộ trên thiết bị/trình duyệt này. Không có tài khoản hay đồng bộ đám mây. Xóa dữ liệu trình duyệt/ứng dụng có thể làm mất nội dung. Hãy xuất bản sao lưu thường xuyên.</p></section>
      <p className="settings-version">época · MVP 0.1 · Mọi nội dung ở riêng trên bản cài đặt này.</p>
    </div>
  )
}

function TaskDialog({ initial, initialStartAt, labels, onClose, onSaveTask, onSaveEvent, onDelete, onAddLabel }: {
  initial: CalendarRecord | null; initialStartAt: string | null
  labels: AppData['labels']; onClose: () => void; onSaveTask: (task: Task) => Promise<boolean>
  onSaveEvent: (event: CalendarEvent) => Promise<boolean>; onDelete: () => void
  onAddLabel: (name: string) => Promise<void>
}) {
  const editingEvent = initial?.kind === 'event'
  const [kind, setKind] = useState<'task' | 'event'>(editingEvent ? 'event' : 'task')
  const [baseRecords] = useState(() => {
    const now = new Date().toISOString()
    return {
      task: initial?.kind === 'task' ? initial.record : {
        id: createId(), title: '', description: '', status: 'todo' as const, priority: 'none' as const,
        startAt: initialStartAt, endAt: null, dueAt: null, showInCalendar: Boolean(initialStartAt),
        labelIds: [], completedAt: null, createdAt: now, updatedAt: now, sortOrder: Date.now(),
      },
      event: initial?.kind === 'event' ? initial.record : {
        id: createId(), title: '', description: '', startAt: initialStartAt ?? now, endAt: null,
        allDay: false, reminderMinutes: null, color: '#6c9c8c', createdAt: now, updatedAt: now,
      },
    }
  })
  const baseTask: Task = baseRecords.task
  const baseEvent: CalendarEvent = baseRecords.event
  const [title, setTitle] = useState(initial?.record.title ?? '')
  const [description, setDescription] = useState(initial?.record.description ?? '')
  const [startAt, setStartAt] = useState(toLocalInputValue(kind === 'task' ? baseTask.startAt : baseEvent.startAt))
  const [endAt, setEndAt] = useState(toLocalInputValue(kind === 'task' ? baseTask.endAt : baseEvent.endAt))
  const [dueAt, setDueAt] = useState(toLocalInputValue(baseTask.dueAt))
  const [status, setStatus] = useState<TaskStatus>(baseTask.status)
  const [priority, setPriority] = useState<Priority>(baseTask.priority)
  const [labelIds, setLabelIds] = useState(baseTask.labelIds)
  const [showInCalendar, setShowInCalendar] = useState(baseTask.showInCalendar)
  const [allDay, setAllDay] = useState(baseEvent.allDay)
  const [reminderMinutes, setReminderMinutes] = useState(baseEvent.reminderMinutes === null ? '' : String(baseEvent.reminderMinutes))
  const [error, setError] = useState('')
  const toggleLabel = (id: string) => setLabelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const handleSave = async () => {
    try {
      setError('')
      const timestamp = new Date().toISOString()
      if (kind === 'event') {
        const record: CalendarEvent = { ...baseEvent, title: title.trim(), description: description.trim(), startAt: fromLocalInputValue(startAt) ?? '', endAt: fromLocalInputValue(endAt), allDay, reminderMinutes: reminderMinutes === '' ? null : Number(reminderMinutes), updatedAt: timestamp }
        validateEvent(record)
        await onSaveEvent(record)
      } else {
        const record: Task = {
          ...baseTask, title: title.trim(), description: description.trim(), status, priority,
          startAt: fromLocalInputValue(startAt), endAt: fromLocalInputValue(endAt), dueAt: fromLocalInputValue(dueAt),
          showInCalendar, labelIds, completedAt: status === 'done' ? baseTask.completedAt ?? timestamp : null, updatedAt: timestamp,
        }
        validateTask(record)
        await onSaveTask(record)
      }
    } catch (cause) { setError(errorMessage(cause)) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
    <header className="dialog-header"><div><span className="section-kicker">{initial ? 'CHỈNH SỬA' : 'THÊM VÀO KHÔNG GIAN'}</span><h2 id="record-dialog-title">{initial ? (editingEvent ? 'Chỉnh sửa sự kiện' : 'Chỉnh sửa công việc') : 'Tạo mới'}</h2></div><button className="icon-button" aria-label="Đóng" onClick={onClose}><X size={19} /></button></header>
    {!initial && <div className="record-type-tabs"><button className={kind === 'task' ? 'selected' : ''} onClick={() => setKind('task')}><ListTodo size={15} />Công việc</button><button className={kind === 'event' ? 'selected' : ''} onClick={() => setKind('event')}><CalendarDays size={15} />Sự kiện</button></div>}
    <div className="dialog-fields"><label className="field-full">Tiêu đề<input autoFocus placeholder={kind === 'task' ? 'Bạn muốn hoàn thành điều gì?' : 'Tên sự kiện'} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="field-full">Mô tả<textarea rows={2} placeholder="Thêm vài chi tiết…" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Bắt đầu<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label><label>Kết thúc<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
      {kind === 'task' ? <><label>Hạn chót<input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label><label>Ưu tiên<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Trạng thái<select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="check-field"><input type="checkbox" checked={showInCalendar} onChange={(e) => setShowInCalendar(e.target.checked)} />Hiển thị trên lịch</label>
        {!!labels.length && <div className="field-full label-options"><span>Nhãn</span><div>{labels.map((label) => <label key={label.id}><input type="checkbox" checked={labelIds.includes(label.id)} onChange={() => toggleLabel(label.id)} />{label.name}</label>)}<button type="button" className="text-button" onClick={async () => { const name = window.prompt('Tên nhãn mới'); if (name?.trim()) { await onAddLabel(name); } }}>+ Tạo nhãn</button></div></div>}
        {!labels.length && <button className="text-button field-full create-label" onClick={async () => { const name = window.prompt('Tên nhãn mới'); if (name?.trim()) await onAddLabel(name) }}><Tag size={14} /> Tạo nhãn đầu tiên</button>}
      </> : <><label className="check-field"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />Sự kiện cả ngày</label><label>Nhắc trong ứng dụng<select value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}><option value="">Không nhắc</option><option value="0">Đúng giờ</option><option value="5">Trước 5 phút</option><option value="15">Trước 15 phút</option><option value="30">Trước 30 phút</option><option value="60">Trước 1 giờ</option></select></label></>}
    </div>{error && <p className="form-error" role="alert">{error}</p>}
    <footer className="dialog-footer">{initial && <button className="button button-danger ghost-danger" onClick={onDelete}><Trash2 size={15} />Xóa</button>}<div><button className="button button-secondary" onClick={onClose}>Hủy</button><button className="button button-primary" onClick={handleSave}><Check size={16} />Lưu lại</button></div></footer>
  </section></div>
}

function isToday(value: string | null, today: string): boolean {
  return Boolean(value && localDateKey(new Date(value)) === today)
}

function initialPage(): Page {
  const requested = window.location.hash.replace(/^#\/?/, '')
  const pages: Page[] = ['dashboard', 'todo', 'kanban', 'calendar', 'journal', 'spaces', 'settings']
  return pages.includes(requested as Page) ? requested as Page : 'dashboard'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function formatDateTime(value: string, use24HourTime = true): string {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: use24HourTime ? 'h23' : 'h12' }).format(new Date(value))
}

function shiftedDate(endAt: string, oldStart: string, newStart: string): string {
  const duration = new Date(endAt).getTime() - new Date(oldStart).getTime()
  return new Date(new Date(newStart).getTime() + duration).toISOString()
}

function calendarWeekStart(date: Date, weekStartsOn: 0 | 1): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() - weekStartsOn + 7) % 7))
  return start
}

function startAtOf(item: CalendarRecord): string {
  if (item.kind === 'event') return item.record.startAt
  if (!item.record.startAt) throw new Error('Công việc này chưa được lên lịch.')
  return item.record.startAt
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi khi lưu dữ liệu.'
}

export default App
