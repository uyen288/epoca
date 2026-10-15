import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer(): Promise<void> {
  if (!MONGODB_URI) {
    process.stderr.write('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.\n');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    process.stderr.write(`MongoDB connection failed (${error.name}). Check MONGODB_URI and make sure the database is running.\n`);
    process.exitCode = 1;
    return;
  }

  const server = app.listen(PORT, () => {
    process.stdout.write(`época API listening on port ${PORT}\n`);
  });

  async function shutdown(): Promise<void> {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void startServer();
