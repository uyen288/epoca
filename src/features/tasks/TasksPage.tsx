import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Circle, ListFilter, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiRequest, emptyResponseSchema, jsonBody, taskListResponseSchema, taskMutationResponseSchema } from '@/lib/api';
import { isTaskPriority, type Task, type TaskInput, type TaskPriority, type TaskStatus } from '@/types';
import { TaskForm } from './TaskForm';

type TaskFilter = 'all' | TaskStatus;

const FILTERS: { label: string; value: TaskFilter }[] = [
  { label: 'Everything', value: 'all' },
  { label: 'To do', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
];

function formatDate(value: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function isOverdue(task: Task) {
  return Boolean(task.dueDate && task.status !== 'done' && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0));
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();
  const taskQuery = useQuery({
    queryKey: ['tasks', filter, priority, search],
    queryFn: () => apiRequest(`/tasks?${new URLSearchParams({
      ...(filter !== 'all' ? { status: filter } : {}),
      ...(priority !== 'all' ? { priority } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    })}`, taskListResponseSchema),
  });
  const saveMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId?: string; input: TaskInput }) => apiRequest(
      taskId ? `/tasks/${taskId}` : '/tasks',
      taskMutationResponseSchema,
      { method: taskId ? 'PATCH' : 'POST', body: jsonBody(input) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setEditingTask(undefined);
      setShowForm(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => apiRequest(`/tasks/${taskId}`, emptyResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setDeletingTask(undefined);
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => apiRequest(
      `/tasks/${taskId}`,
      taskMutationResponseSchema,
      { method: 'PATCH', body: jsonBody({ status }) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
  const tasks = taskQuery.data?.items ?? [];

  function openCreateForm() {
    setEditingTask(undefined);
    setShowForm(true);
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><span className="eyebrow">A PLACE FOR YOUR NEXT STEPS</span><h1>Tasks</h1><p>Keep the important things moving, one at a time.</p></div>
        <button className="button button-primary" type="button" onClick={openCreateForm}><Plus size={17} /> New task</button>
      </div>
      {(showForm || editingTask) && <TaskForm key={editingTask?.id ?? 'new'} task={editingTask} isSaving={saveMutation.isPending} onSave={(input) => saveMutation.mutate({ taskId: editingTask?.id, input })} onCancel={() => { setShowForm(false); setEditingTask(undefined); saveMutation.reset(); }} />}
      {saveMutation.isError && <p className="inline-error" role="alert">{saveMutation.error.message}</p>}
      <div className="list-toolbar">
        <div className="filter-tabs" aria-label="Filter tasks">
          {FILTERS.map((item) => <button type="button" key={item.value} className={filter === item.value ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <div className="task-search-controls">
          <label className="priority-filter"><ListFilter size={15} /><span className="sr-only">Filter by priority</span><select value={priority} onChange={(event) => setPriority(isTaskPriority(event.target.value) ? event.target.value : 'all')}><option value="all">Any priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></label>
          <label className="search-input"><Search size={17} /><span className="sr-only">Search tasks</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task…" /></label>
        </div>
      </div>
      {taskQuery.isPending ? <div className="loading-panel"><span className="spinner" />Gathering your tasks…</div> :
        taskQuery.isError ? <div className="state-card"><h2>Couldn’t load your tasks</h2><p>{taskQuery.error.message}</p><button className="button button-secondary" type="button" onClick={() => void taskQuery.refetch()}>Try again</button></div> :
          tasks.length === 0 ? <div className="empty-card"><span className="empty-icon"><ListFilter size={22} /></span><h2>{search ? 'Nothing found just yet' : 'A little room to begin'}</h2><p>{search ? 'Try another search or clear your filters.' : 'Add a task and give your attention somewhere to land.'}</p>{!search && <button className="button button-secondary" type="button" onClick={openCreateForm}><Plus size={16} /> Create your first task</button>}</div> :
            <div className="task-list">
              {tasks.map((task) => (
                <article className={`task-row ${task.status === 'done' ? 'is-complete' : ''}`} key={task.id}>
                  <button className="task-check" type="button" disabled={statusMutation.isPending} aria-label={task.status === 'done' ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`} onClick={() => statusMutation.mutate({ taskId: task.id, status: task.status === 'done' ? 'todo' : 'done' })}>
                    {task.status === 'done' ? <Check size={15} /> : <Circle size={19} />}
                  </button>
                  <div className="task-copy"><h2>{task.title}</h2>{task.description && <p>{task.description}</p>}{task.tags.length > 0 && <div className="tag-list">{task.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}</div>
                  <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                  <span className={`task-date ${isOverdue(task) ? 'overdue' : ''}`}>{isOverdue(task) ? 'Overdue · ' : ''}{formatDate(task.dueDate)}</span>
                  <div className="task-actions"><button className="icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => { setShowForm(false); setEditingTask(task); }}><Pencil size={16} /></button><button className="icon-button delete-button" type="button" aria-label={`Delete ${task.title}`} onClick={() => setDeletingTask(task)}><Trash2 size={16} /></button></div>
                </article>
              ))}
            </div>}
      {statusMutation.isError && <p className="inline-error" role="alert">{statusMutation.error.message}</p>}
      {deletingTask && <div className="confirm-banner" role="alert"><span>Remove “{deletingTask.title}” from your list?</span><button className="button button-quiet" type="button" onClick={() => setDeletingTask(undefined)}>Keep task</button><button className="button button-danger" type="button" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingTask.id)}>{deleteMutation.isPending ? 'Removing…' : 'Remove'}</button></div>}
      {deleteMutation.isError && <p className="inline-error" role="alert">{deleteMutation.error.message}</p>}
    </section>
  );
}

export function TaskStatusLabel({ status }: { status: TaskStatus }) {
  const names: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
  return <span className={`status-label status-${status}`}>{names[status]}</span>;
}

export function PriorityLabel({ priority }: { priority: TaskPriority }) {
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
}
