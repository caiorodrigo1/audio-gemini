import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  at: number;
}

export interface ProgressEvent {
  status: 'running' | 'done' | 'error' | 'log';
  processed?: number;
  total?: number;
  message?: string;
  level?: LogLevel;
}

export interface JobState {
  id: string;
  status: JobStatus;
  processed: number;
  total: number;
  audio?: Buffer;
  errorMessage?: string;
  logs: LogEntry[];
  /** Nome do arquivo pedido pelo cliente da API compatível com ai33 */
  fileName?: string;
  subscribers: Array<(event: ProgressEvent) => void>;
  createdAt: Date;
  finishedAt?: Date;
}

type Runner = (
  text: string,
  voiceName: string,
  onProgress: (event: ProgressEvent) => void,
) => Promise<Buffer>;

@Injectable()
export class JobService {
  private readonly jobs = new Map<string, JobState>();
  private readonly cleanupAfterMs = 30 * 60 * 1000;
  private readonly cleanupHandle: NodeJS.Timeout;

  constructor(private readonly runner: { run: Runner } | Runner) {
    this.cleanupHandle = setInterval(() => this.cleanupOldJobs(), 5 * 60 * 1000);
    if (typeof (this.cleanupHandle as any).unref === 'function') {
      (this.cleanupHandle as any).unref();
    }
  }

  create(text: string, voiceName: string, runner?: Runner): string {
    const id = randomUUID();
    const state: JobState = {
      id,
      status: 'pending',
      processed: 0,
      total: 0,
      logs: [],
      subscribers: [],
      createdAt: new Date(),
    };
    this.jobs.set(id, state);

    const fn = runner
      ?? (typeof this.runner === 'function' ? this.runner : this.runner.run);

    void this.execute(state, text, voiceName, fn);
    return id;
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id);
  }

  subscribe(id: string, fn: (event: ProgressEvent) => void): () => void {
    const job = this.jobs.get(id);
    if (!job) return () => {};
    job.subscribers.push(fn);

    // Replay buffered logs first so late subscribers see prior errors.
    for (const log of job.logs) {
      fn({ status: 'log', level: log.level, message: log.message });
    }

    if (job.status === 'running' && job.total > 0) {
      fn({ status: 'running', processed: job.processed, total: job.total });
    } else if (job.status === 'done') {
      fn({ status: 'done' });
    } else if (job.status === 'error') {
      fn({ status: 'error', message: job.errorMessage });
    }
    return () => {
      job.subscribers = job.subscribers.filter(s => s !== fn);
    };
  }

  private async execute(state: JobState, text: string, voiceName: string, runner: Runner) {
    state.status = 'running';
    try {
      const buffer = await runner(text, voiceName, (event) => {
        if (event.status === 'running') {
          state.processed = event.processed ?? state.processed;
          state.total = event.total ?? state.total;
        } else if (event.status === 'log' && event.message) {
          const entry: LogEntry = {
            level: event.level ?? 'info',
            message: event.message,
            at: Date.now(),
          };
          state.logs.push(entry);
          // Cap log buffer to avoid unbounded memory growth.
          if (state.logs.length > 200) state.logs.shift();
        }
        for (const sub of state.subscribers) sub(event);
      });
      state.audio = buffer;
      state.status = 'done';
      state.finishedAt = new Date();
      for (const sub of state.subscribers) sub({ status: 'done' });
    } catch (err: any) {
      state.status = 'error';
      state.errorMessage = err?.message ?? 'Erro desconhecido';
      state.finishedAt = new Date();
      for (const sub of state.subscribers) sub({ status: 'error', message: state.errorMessage });
    }
  }

  private cleanupOldJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && now - job.finishedAt.getTime() > this.cleanupAfterMs) {
        this.jobs.delete(id);
      }
    }
  }
}
