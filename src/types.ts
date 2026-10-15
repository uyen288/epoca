export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export function isTaskStatus(value: string): value is TaskStatus {
  return ['todo', 'in_progress', 'done'].some((status) => status === value);
}

export function isTaskPriority(value: string): value is TaskPriority {
  return ['low', 'medium', 'high'].some((priority) => priority === value);
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  action: string;
  entityType: 'task' | 'note';
  summary: string;
  createdAt: string;
}

export interface DashboardSummary {
  counts: {
    openTasks: number;
    completedTasks: number;
    notes: number;
  };
  todayTasks: Task[];
  upcomingTasks: Task[];
  recentNotes: Note[];
  recentActivities: Activity[];
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  tags?: string[];
}

export interface NoteInput {
  title: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}
