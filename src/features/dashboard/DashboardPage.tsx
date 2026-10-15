import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Clock3, FileText, Plus, Sparkles } from 'lucide-react';
import { apiRequest, captureResponseSchema, dashboardSummarySchema, jsonBody, taskMutationResponseSchema } from '@/lib/api';
import type { Task, TaskStatus } from '@/types';

const STATUS_NAMES: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(value: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPage({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const [captureType, setCaptureType] = useState<'task' | 'note'>('task');
  const [captureTitle, setCaptureTitle] = useState('');
  const summaryQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest('/dashboard/summary', dashboardSummarySchema),
  });
  const captureMutation = useMutation({
    mutationFn: () => apiRequest(
      captureType === 'task' ? '/tasks' : '/notes',
      captureResponseSchema,
      {
        method: 'POST',
        body: jsonBody(captureType === 'task'
          ? { title: captureTitle.trim() }
          : { title: captureTitle.trim(), content: '' }),
      },
    ),
    onSuccess: async () => {
      setCaptureTitle('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
      ]);
    },
  });
  const statusMutation = useMutation({
    mutationFn: (task: Task) => apiRequest(
      `/tasks/${task.id}`,
      taskMutationResponseSchema,
      { method: 'PATCH', body: jsonBody({ status: task.status === 'done' ? 'todo' : 'done' }) },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);
    },
  });
  const summary = summaryQuery.data;
  const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const openTasks = summary?.counts.openTasks ?? 0;
  const doneTasks = summary?.counts.completedTasks ?? 0;
  const taskTotal = openTasks + doneTasks;
  const completion = taskTotal ? Math.round((doneTasks / taskTotal) * 100) : 0;

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captureTitle.trim()) captureMutation.mutate();
  }

  return (
    <section className="page-section dashboard-page">
      <header className="welcome-heading">
        <div><span className="eyebrow">{todayLabel.toUpperCase()}</span><h1>{greetingForHour(new Date().getHours())}, {userName.split(' ')[0]}<span className="greeting-period">.</span></h1><p>Let’s make a little space for what matters today.</p></div>
        <div className="daily-mark"><Sparkles size={19} /><span>Take it one thing at a time</span></div>
      </header>
      {summaryQuery.isPending ? <div className="loading-panel"><span className="spinner" />Bringing your day into view…</div> :
        summaryQuery.isError ? <div className="state-card"><h2>Your overview is taking a moment</h2><p>{summaryQuery.error.message}</p><button className="button button-secondary" type="button" onClick={() => void summaryQuery.refetch()}>Try again</button></div> :
          <>
            <div className="summary-grid">
              <article className="summary-card summary-primary"><div className="summary-icon"><Check size={18} /></div><span className="summary-label">Open tasks</span><strong>{summary?.counts.openTasks}</strong><span className="summary-foot">{openTasks === 0 ? 'A little room to breathe' : 'Things moving forward'}</span><Link to="/tasks" aria-label="View tasks"><ArrowUpRight size={17} /></Link></article>
              <article className="summary-card summary-lilac"><div className="summary-icon"><Sparkles size={17} /></div><span className="summary-label">Completed</span><strong>{summary?.counts.completedTasks}</strong><span className="summary-foot">{completion}% of all your tasks</span><div className="progress-track"><span style={{ width: `${completion}%` }} /></div></article>
              <article className="summary-card summary-paper"><div className="summary-icon"><FileText size={17} /></div><span className="summary-label">Notes saved</span><strong>{summary?.counts.notes}</strong><span className="summary-foot">Thoughts worth keeping</span><Link to="/notes" aria-label="View notes"><ArrowUpRight size={17} /></Link></article>
            </div>
            <div className="dashboard-grid">
              <section className="content-panel today-panel">
                <div className="panel-heading"><div><span className="eyebrow">YOUR NEXT STEPS</span><h2>On your mind</h2></div><Link className="text-link" to="/tasks">All tasks <ArrowRight size={15} /></Link></div>
                {summary?.todayTasks.length === 0 ? <div className="dashboard-empty"><span className="empty-icon"><Sparkles size={19} /></span><h3>Nothing pressing today</h3><p>Enjoy the breathing room, or make a plan for what’s next.</p><Link className="text-link" to="/tasks">See all tasks <ArrowRight size={15} /></Link></div> :
                  <div className="today-list">{summary?.todayTasks.map((task) => <article className="today-row" key={task.id}><button className="task-check" type="button" disabled={statusMutation.isPending} aria-label={`Mark ${task.title} ${task.status === 'done' ? 'not done' : 'done'}`} onClick={() => statusMutation.mutate(task)}>{task.status === 'done' ? <Check size={15} /> : <span className="check-ring" />}</button><div className="today-task-copy"><h3>{task.title}</h3><div className="today-task-meta"><span className={`status-label status-${task.status}`}>{STATUS_NAMES[task.status]}</span><span className="today-due"><Clock3 size={13} />{shortDate(task.dueDate)}</span></div></div><span className={`priority-dot dot-${task.priority}`} aria-label={`${task.priority} priority`} /> </article>)}</div>}
                {summary?.upcomingTasks.length ? <div className="upcoming-block"><div className="upcoming-heading"><span>COMING UP</span><Link className="text-link" to="/tasks">View all</Link></div>{summary.upcomingTasks.map((task) => <div className="upcoming-row" key={task.id}><span className="upcoming-date">{shortDate(task.dueDate)}</span><strong>{task.title}</strong><span className={`priority-dot dot-${task.priority}`} aria-label={`${task.priority} priority`} /></div>)}</div> : null}
                {statusMutation.isError && <p className="inline-error" role="alert">{statusMutation.error.message}</p>}
              </section>
              <section className="content-panel capture-panel">
                <div className="panel-heading"><div><span className="eyebrow">CATCH IT WHILE IT’S HERE</span><h2>Quick capture</h2></div><span className="capture-spark"><Sparkles size={16} /></span></div>
                <p className="capture-copy">A thought, a task, a small thing for later.</p>
                <div className="capture-switch" role="group" aria-label="Choose what to capture"><button type="button" className={captureType === 'task' ? 'selected' : ''} onClick={() => setCaptureType('task')}>Task</button><button type="button" className={captureType === 'note' ? 'selected' : ''} onClick={() => setCaptureType('note')}>Note</button></div>
                <form className="capture-form" onSubmit={submitCapture}><label className="sr-only" htmlFor="quick-capture">{captureType === 'task' ? 'Task title' : 'Note title'}</label><input id="quick-capture" value={captureTitle} onChange={(event) => setCaptureTitle(event.target.value)} maxLength={160} placeholder={captureType === 'task' ? 'What needs doing?' : 'What’s on your mind?'} required /><button className="capture-submit" type="submit" disabled={captureMutation.isPending || !captureTitle.trim()} aria-label={`Add ${captureType}`}><Plus size={18} /></button></form>
                {captureMutation.isError && <p className="form-error" role="alert">{captureMutation.error.message}</p>}
                {captureMutation.isSuccess && <p className="capture-success"><Check size={14} /> Saved to your {captureType === 'task' ? 'tasks' : 'notes'}.</p>}
              </section>
              <section className="content-panel recent-notes-panel">
                <div className="panel-heading"><div><span className="eyebrow">LITTLE THINGS TO REMEMBER</span><h2>Recently captured</h2></div><Link className="text-link" to="/notes">All notes <ArrowRight size={15} /></Link></div>
                {summary?.recentNotes.length === 0 ? <div className="compact-empty"><FileText size={18} /><p>Your saved thoughts will find a home here.</p></div> : <div className="recent-note-list">{summary?.recentNotes.map((note) => <Link className="recent-note" to="/notes" key={note.id}><span className="note-small-icon"><FileText size={15} /></span><span className="recent-note-copy"><strong>{note.title}</strong><small>{note.content || 'A new thought, saved for later.'}</small></span><time>{relativeTime(note.updatedAt)}</time></Link>)}</div>}
              </section>
              <section className="content-panel activity-panel">
                <div className="panel-heading"><div><span className="eyebrow">A QUIET RECORD</span><h2>Recent activity</h2></div><ArrowDownRight className="activity-decoration" size={19} /></div>
                {summary?.recentActivities.length === 0 ? <div className="compact-empty"><Clock3 size={18} /><p>Your recent work will show up here.</p></div> : <ul className="activity-list">{summary?.recentActivities.map((activity) => <li key={activity.id}><span className={`activity-mark activity-${activity.entityType}`}><span /></span><div><p><strong>{activity.summary}</strong> {activity.action} {activity.entityType}</p><time>{relativeTime(activity.createdAt)}</time></div></li>)}</ul>}
              </section>
            </div>
          </>}
    </section>
  );
}
