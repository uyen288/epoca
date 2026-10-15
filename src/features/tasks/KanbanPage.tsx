import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, CircleDashed, Clock3 } from 'lucide-react';
import { apiRequest, jsonBody, taskListResponseSchema, taskMutationResponseSchema } from '@/lib/api';
import type { TaskStatus } from '@/types';
import { PriorityLabel } from './TasksPage';

const COLUMNS: { status: TaskStatus; title: string; icon: typeof CircleDashed; subtitle: string }[] = [
  { status: 'todo', title: 'To do', icon: CircleDashed, subtitle: 'When you’re ready' },
  { status: 'in_progress', title: 'In progress', icon: Clock3, subtitle: 'In motion now' },
  { status: 'done', title: 'Done', icon: CircleCheck, subtitle: 'Look how far you’ve come' },
];

export function KanbanPage() {
  const queryClient = useQueryClient();
  const taskQuery = useQuery({
    queryKey: ['tasks', 'board'],
    queryFn: () => apiRequest('/tasks', taskListResponseSchema),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => apiRequest(
      `/tasks/${id}`, taskMutationResponseSchema, { method: 'PATCH', body: jsonBody({ status }) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
  const tasks = taskQuery.data?.items ?? [];

  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow">SEE THE SHAPE OF YOUR DAY</span><h1>Kanban</h1><p>A gentle overview of everything in motion.</p></div></div>
      {taskQuery.isPending ? <div className="loading-panel"><span className="spinner" />Gathering your tasks…</div> :
        taskQuery.isError ? <div className="state-card"><h2>Your board is taking a moment</h2><p>{taskQuery.error.message}</p><button className="button button-secondary" type="button" onClick={() => void taskQuery.refetch()}>Try again</button></div> :
          <div className="kanban-board">
            {COLUMNS.map((column) => {
              const Icon = column.icon;
              const columnTasks = tasks.filter((task) => task.status === column.status);
              return <section className={`kanban-column column-${column.status}`} key={column.status} aria-label={`${column.title}: ${columnTasks.length} tasks`}>
                <header className="column-header"><div className="column-title"><span className="column-icon"><Icon size={17} /></span><div><h2>{column.title}</h2><p>{column.subtitle}</p></div></div><span className="column-count">{columnTasks.length}</span></header>
                <div className="column-cards">
                  {columnTasks.length === 0 ? <p className="column-empty">Nothing here for now.</p> : columnTasks.map((task) => {
                    const nextStatus: TaskStatus = column.status === 'todo' ? 'in_progress' : column.status === 'in_progress' ? 'done' : 'todo';
                    const nextLabel = column.status === 'todo' ? 'Move to In progress' : column.status === 'in_progress' ? 'Mark done' : 'Move back to To do';
                    return <article className="kanban-card" key={task.id}>
                      <div className="kanban-card-top"><PriorityLabel priority={task.priority} />{task.dueDate && <span className="kanban-due">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(task.dueDate))}</span>}</div>
                      <h3>{task.title}</h3>
                      {task.description && <p>{task.description}</p>}
                      <button className="move-task" type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: task.id, status: nextStatus })}><span>{nextLabel}</span><ArrowRight size={15} /></button>
                    </article>;
                  })}
                </div>
              </section>;
            })}
          </div>}
      {statusMutation.isError && <p className="inline-error" role="alert">{statusMutation.error.message}</p>}
    </section>
  );
}
