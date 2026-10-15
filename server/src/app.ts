import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Activity, Note, Task, User } from './models.js';
import { AppError } from './lib/app-error.js';

const API_PREFIX = '/api/v1';
const AUTH_COOKIE = 'epoca_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_MAX_AGE = TOKEN_TTL_SECONDS * 1000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(500, 'SERVER_CONFIGURATION_ERROR', 'Authentication is not configured.');
  }
  return secret;
}

const app = express();

const allowedOriginPatterns = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOriginPatterns.includes(origin)) {
      callback(null, true);
      return;
    }

    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):517[3-9]$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(
  API_PREFIX,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }),
);

const asyncRoute = (
  handler: (request: express.Request, response: express.Response) => Promise<void>,
): RequestHandler => (request, response, next) => {
  void handler(request, response).catch(next);
};

const objectIdSchema = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid record id.',
});

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72).refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password must be no longer than 72 UTF-8 bytes.',
  }),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.union([z.string().datetime(), z.null()]).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
});

const taskPatchSchema = taskInputSchema.partial();
const taskListQuerySchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  search: z.string().trim().max(160).optional(),
});

const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().max(10000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
  isPinned: z.boolean().optional(),
});

const notePatchSchema = noteInputSchema.partial().refine((input) => Object.keys(input).length > 0, {
  message: 'At least one field must be provided.',
});
const noteListQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  tag: z.string().trim().min(1).max(32).optional(),
});
const taskPatchInputSchema = taskPatchSchema.refine((input) => Object.keys(input).length > 0, {
  message: 'At least one field must be provided.',
});

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Invalid request.');
  }
  return result.data;
}

function setSessionCookie(response: express.Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
  response.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

const requireAuth: RequestHandler = (request, _response, next) => {
  const token: unknown = request.cookies[AUTH_COOKIE];
  if (typeof token !== 'string') {
    next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.'));
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'UNAUTHORIZED', 'Your session is invalid. Please sign in again.');
    }
    request.userId = payload.sub;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'UNAUTHORIZED', 'Your session has expired.'));
  }
};

function getUserId(request: express.Request): string {
  if (!request.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
  }
  return request.userId;
}

function getWorkspaceId(request: express.Request): string {
  const workspaceId = request.get('X-Workspace-Id');
  if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
    throw new AppError(400, 'INVALID_WORKSPACE', 'This browser workspace is invalid. Reload the page to create a new one.');
  }
  return workspaceId;
}

function publicUser(user: { _id: mongoose.Types.ObjectId; name: string; email: string }) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

function serializeTask(task: {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    tags: task.tags,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeNote(note: {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note._id.toString(),
    title: note.title,
    content: note.content,
    tags: note.tags,
    isPinned: note.isPinned,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

const api = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

api.post('/auth/register', authLimiter, asyncRoute(async (request, response) => {
  const input = parseBody(registerSchema, request.body);
  const email = input.email.toLowerCase();
  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email, passwordHash });
  setSessionCookie(response, user._id.toString());
  response.status(201).json({ user: publicUser(user) });
}));

api.post('/auth/login', authLimiter, asyncRoute(async (request, response) => {
  const input = parseBody(loginSchema, request.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  setSessionCookie(response, user._id.toString());
  response.json({ user: publicUser(user) });
}));

api.post('/auth/logout', (_request, response) => {
  response.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  response.status(204).end();
});

api.get('/auth/me', requireAuth, asyncRoute(async (request, response) => {
  const user = await User.findById(getUserId(request)).select('_id name email');
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Your account is no longer available.');
  response.json({ user: publicUser(user) });
}));

api.get('/tasks', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const { status, priority, search } = parseBody(taskListQuerySchema, request.query);
  const filter: Record<string, unknown> = { userId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (search) {
    filter.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  const tasks = await Task.find(filter).sort({ dueDate: 1, updatedAt: -1 }).limit(200);
  response.json({ items: tasks.map(serializeTask) });
}));

api.get('/tasks/:id', asyncRoute(async (request, response) => {
  const taskId = parseBody(objectIdSchema, request.params.id);
  const task = await Task.findOne({ _id: taskId, userId: getWorkspaceId(request) });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  response.json({ item: serializeTask(task) });
}));

api.post('/tasks', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const input = parseBody(taskInputSchema, request.body);
  const task = await Task.create({
    ...input,
    userId,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
  });
  await Activity.create({
    userId, action: 'created', entityType: 'task', entityId: task._id, summary: task.title,
  });
  response.status(201).json({ item: serializeTask(task) });
}));

api.patch('/tasks/:id', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const taskId = parseBody(objectIdSchema, request.params.id);
  const input = parseBody(taskPatchInputSchema, request.body);
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId },
    { ...input, ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}) },
    { returnDocument: 'after', runValidators: true },
  );
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  await Activity.create({
    userId,
    action: input.status === 'done' ? 'completed' : 'updated',
    entityType: 'task',
    entityId: task._id,
    summary: task.title,
  });
  response.json({ item: serializeTask(task) });
}));

api.delete('/tasks/:id', asyncRoute(async (request, response) => {
  const taskId = parseBody(objectIdSchema, request.params.id);
  const task = await Task.findOneAndDelete({ _id: taskId, userId: getWorkspaceId(request) });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  response.status(204).end();
}));

api.get('/notes', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const { search, tag } = parseBody(noteListQuerySchema, request.query);
  const filter: Record<string, unknown> = { userId };
  if (tag) filter.tags = tag;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escapedSearch, $options: 'i' } },
      { content: { $regex: escapedSearch, $options: 'i' } },
    ];
  }
  const notes = await Note.find(filter).sort({ isPinned: -1, updatedAt: -1 }).limit(200);
  response.json({ items: notes.map(serializeNote) });
}));

api.get('/notes/:id', asyncRoute(async (request, response) => {
  const noteId = parseBody(objectIdSchema, request.params.id);
  const note = await Note.findOne({ _id: noteId, userId: getWorkspaceId(request) });
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found.');
  response.json({ item: serializeNote(note) });
}));

api.post('/notes', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const input = parseBody(noteInputSchema, request.body);
  const note = await Note.create({ ...input, userId });
  await Activity.create({
    userId, action: 'created', entityType: 'note', entityId: note._id, summary: note.title,
  });
  response.status(201).json({ item: serializeNote(note) });
}));

api.patch('/notes/:id', asyncRoute(async (request, response) => {
  const noteId = parseBody(objectIdSchema, request.params.id);
  const input = parseBody(notePatchSchema, request.body);
  const userId = getWorkspaceId(request);
  const note = await Note.findOneAndUpdate(
    { _id: noteId, userId },
    input,
    { returnDocument: 'after', runValidators: true },
  );
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found.');
  await Activity.create({
    userId, action: 'updated', entityType: 'note', entityId: note._id, summary: note.title,
  });
  response.json({ item: serializeNote(note) });
}));

api.delete('/notes/:id', asyncRoute(async (request, response) => {
  const noteId = parseBody(objectIdSchema, request.params.id);
  const note = await Note.findOneAndDelete({ _id: noteId, userId: getWorkspaceId(request) });
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found.');
  response.status(204).end();
}));

api.get('/dashboard/summary', asyncRoute(async (request, response) => {
  const userId = getWorkspaceId(request);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const nextWeekStart = new Date(tomorrowStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const [openTasks, completedTasks, notesCount, dueTasks, upcomingTasks, recentNotes, recentActivities] = await Promise.all([
    Task.countDocuments({ userId, status: { $ne: 'done' } }),
    Task.countDocuments({ userId, status: 'done' }),
    Note.countDocuments({ userId }),
    Task.find({
      userId,
      status: { $ne: 'done' },
      dueDate: { $lt: tomorrowStart },
    }).sort({ dueDate: 1 }).limit(6),
    Task.find({
      userId,
      status: { $ne: 'done' },
      dueDate: { $gte: tomorrowStart, $lt: nextWeekStart },
    }).sort({ dueDate: 1 }).limit(4),
    Note.find({ userId }).sort({ updatedAt: -1 }).limit(4),
    Activity.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  response.json({
    counts: { openTasks, completedTasks, notes: notesCount },
    todayTasks: dueTasks.map(serializeTask),
    upcomingTasks: upcomingTasks.map(serializeTask),
    recentNotes: recentNotes.map(serializeNote),
    recentActivities: recentActivities.map((activity) => ({
      id: activity._id.toString(),
      action: activity.action,
      entityType: activity.entityType,
      summary: activity.summary,
      createdAt: activity.createdAt.toISOString(),
    })),
  });
}));

api.get('/activity-logs', asyncRoute(async (request, response) => {
  const activities = await Activity.find({ userId: getWorkspaceId(request) })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  response.json({
    items: activities.map((activity) => ({
      id: activity._id.toString(),
      action: activity.action,
      entityType: activity.entityType,
      summary: activity.summary,
      createdAt: activity.createdAt.toISOString(),
    })),
  });
}));

app.use(API_PREFIX, api);
app.use((_request, _response, next) => next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.')));

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted fields.' } });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({ error: { code: 'INVALID_ID', message: 'The requested id is invalid.' } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    response.status(409).json({ error: { code: 'DUPLICATE_VALUE', message: 'An account with this email already exists.' } });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
    return;
  }
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
};

app.use(errorHandler);

export default app;
