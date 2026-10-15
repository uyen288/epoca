import { z } from 'zod';
import type { Activity, DashboardSummary, Note, Task, User } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
const WORKSPACE_STORAGE_KEY = 'epoca.workspace-id';
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
});

const userSchema: z.ZodType<User> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const taskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().datetime().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const noteSchema: z.ZodType<Note> = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  isPinned: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const activitySchema: z.ZodType<Activity> = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.enum(['task', 'note']),
  summary: z.string(),
  createdAt: z.string().datetime(),
});

export const authResponseSchema = z.object({ user: userSchema });
export const taskListResponseSchema = z.object({ items: z.array(taskSchema) });
export const taskMutationResponseSchema = z.object({ item: taskSchema });
export const noteListResponseSchema = z.object({ items: z.array(noteSchema) });
export const noteMutationResponseSchema = z.object({ item: noteSchema });
export const captureResponseSchema = z.union([taskMutationResponseSchema, noteMutationResponseSchema]);
export const emptyResponseSchema = z.undefined();
export const dashboardSummarySchema: z.ZodType<DashboardSummary> = z.object({
  counts: z.object({
    openTasks: z.number(),
    completedTasks: z.number(),
    notes: z.number(),
  }),
  todayTasks: z.array(taskSchema),
  upcomingTasks: z.array(taskSchema),
  recentNotes: z.array(noteSchema),
  recentActivities: z.array(activitySchema),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getWorkspaceId(): string {
  const savedWorkspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (savedWorkspaceId && OBJECT_ID_PATTERN.test(savedWorkspaceId)) return savedWorkspaceId;

  const randomBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const workspaceId = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  return workspaceId;
}

export async function apiRequest<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Workspace-Id', getWorkspaceId());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối tới máy chủ. Hãy kiểm tra kết nối rồi thử lại.');
  }

  if (response.status === 204) {
    const emptyResult = schema.safeParse(undefined);
    if (!emptyResult.success) {
      throw new ApiError(502, 'INVALID_RESPONSE', 'The server returned an unexpected empty response.');
    }
    return emptyResult.data;
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(502, 'INVALID_RESPONSE', 'The server returned an unreadable response.');
  }
  if (!response.ok) {
    const errorResult = apiErrorSchema.safeParse(result);
    throw new ApiError(
      response.status,
      errorResult.success ? errorResult.data.error?.code ?? 'REQUEST_FAILED' : 'REQUEST_FAILED',
      errorResult.success
        ? errorResult.data.error?.message ?? 'Yêu cầu chưa thành công. Vui lòng thử lại.'
        : 'Yêu cầu chưa thành công. Vui lòng thử lại.',
    );
  }
  const parsedResult = schema.safeParse(result);
  if (!parsedResult.success) {
    throw new ApiError(502, 'INVALID_RESPONSE', 'The server returned data in an unexpected format.');
  }
  return parsedResult.data;
}

export const jsonBody = (body: unknown): string => JSON.stringify(body);
