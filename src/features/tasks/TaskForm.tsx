import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { isTaskPriority, isTaskStatus, type Task, type TaskInput, type TaskPriority, type TaskStatus } from '@/types';

interface TaskFormProps {
  task?: Task;
  isSaving: boolean;
  onSave: (input: TaskInput) => void;
  onCancel: () => void;
}

export function TaskForm({ task, isSaving, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? '');
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '');

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      title: title.trim(),
      description,
      status,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
  }

  return (
    <form className="editor-panel task-editor" onSubmit={submitTask}>
      <div className="editor-heading">
        <div><span className="eyebrow">{task ? 'REFINE YOUR PLAN' : 'A NEW THING TO DO'}</span><h2>{task ? 'Edit task' : 'Add a task'}</h2></div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label="Close task form"><X size={18} /></button>
      </div>
      <label className="field"><span>Task title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="What needs your attention?" /></label>
      <label className="field"><span>A little context <small>Optional</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={2} placeholder="Add a few details…" /></label>
      <div className="form-grid">
        <label className="field"><span>Priority</span><select value={priority} onChange={(event) => { if (isTaskPriority(event.target.value)) setPriority(event.target.value); }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      </div>
      <label className="field"><span>Tags <small>Separate with commas</small></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="work, personal" /></label>
      {task && <label className="field"><span>Status</span><select value={status} onChange={(event) => { if (isTaskStatus(event.target.value)) setStatus(event.target.value); }}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>}
      <div className="editor-actions">
        <button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={isSaving || !title.trim()}>{isSaving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</button>
      </div>
    </form>
  );
}
