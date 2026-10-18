import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../models'
import { IndexedDbRepository } from './indexeddb'

const repository = new IndexedDbRepository()

afterEach(async () => {
  await repository.clear()
})

describe('IndexedDB repository', () => {
  it('creates, reads, updates, and deletes a task across repository instances', async () => {
    const task = {
      id: 'task-persist',
      title: 'Keep this after reopening',
      description: '',
      status: 'todo' as const,
      priority: 'none' as const,
      startAt: null,
      endAt: null,
      dueAt: null,
      showInCalendar: false,
      labelIds: [],
      completedAt: null,
      createdAt: '2026-10-18T08:00:00.000Z',
      updatedAt: '2026-10-18T08:00:00.000Z',
      sortOrder: 0,
    }
    await repository.put('tasks', task)
    const reopened = new IndexedDbRepository()
    expect(await reopened.getAll('tasks')).toEqual([task])
    await reopened.put('tasks', { ...task, title: 'Updated' })
    expect((await repository.getAll('tasks'))[0].title).toBe('Updated')
    await repository.remove('tasks', task.id)
    expect(await repository.getAll('tasks')).toEqual([])
  })

  it('replaces all tables together and clears local data', async () => {
    await repository.put('tasks', {
      id: 'before', title: 'Old record', description: '', status: 'todo', priority: 'none',
      startAt: null, endAt: null, dueAt: null, showInCalendar: false, labelIds: [],
      completedAt: null, createdAt: '', updatedAt: '', sortOrder: 0,
    })
    await repository.replaceAll({
      tasks: [],
      labels: [],
      events: [],
      journalEntries: [],
      folders: [],
      notes: [],
      settings: [DEFAULT_SETTINGS],
    })
    expect(await repository.getAll('tasks')).toEqual([])
    expect(await repository.getAll('settings')).toEqual([DEFAULT_SETTINGS])
    await repository.clear()
    expect(await repository.getAll('settings')).toEqual([])
  })
})
