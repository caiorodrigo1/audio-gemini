# Web UI Audio Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local web UI to the existing NestJS `audio-gemini` project that lets the user paste text, pick a Gemini voice (grouped by gender), watch a progress bar, and play/download the resulting audio.

**Architecture:** A new `WebModule` is added to the existing NestJS app exposing static page + REST + SSE endpoints. A new `JobService` keeps job state in memory. The existing `TTSService` gets one new public method `generateFromText(text, voiceName, onProgress)` that reuses its existing chunking/conversion/concatenation methods (writing to a temp dir, then reading the final buffer back). The CLI entrypoint is preserved unchanged; a new `--web` flag boots the HTTP server instead of the console flow. Frontend is plain HTML/CSS/JS in `public/`.

**Tech Stack:** NestJS 11, `@nestjs/platform-express` (already a dep), TypeScript, vanilla JS, Server-Sent Events.

**Spec:** `docs/superpowers/specs/2026-05-01-web-ui-audio-generation-design.md`

---

## File Structure

**Created:**
- `src/config/gemini-voices.config.ts` — Gemini prebuilt voices grouped by gender + default.
- `src/web/web.module.ts` — module wiring controller + service.
- `src/web/job.service.ts` — in-memory job state and SSE subscriber management.
- `src/web/web.controller.ts` — HTTP endpoints (static, voices, generate, events, audio).
- `src/web/dto.ts` — request/response shapes.
- `public/index.html` — single-page UI.
- `public/styles.css` — dark mode styling.
- `public/app.js` — frontend behavior (voices fetch, generate, SSE, audio playback).
- `tests/job.service.test.ts` — unit tests for `JobService`.
- `tests/tts.generateFromText.test.ts` — integration test mocking the Gemini call.

**Modified:**
- `src/services/tts.service.ts` — add `convertToSpeech(chunk, voiceName?)` overload behavior + new `generateFromText(text, voiceName, onProgress)` method.
- `src/app.module.ts` — register `WebModule`.
- `src/main.ts` — branch into HTTP server when `--web` flag present.
- `package.json` — add `web` script and a test script (Jest) if not present.

---

## Task 1: Gemini voices config

**Files:**
- Create: `src/config/gemini-voices.config.ts`

- [ ] **Step 1: Create the config file**

```ts
// src/config/gemini-voices.config.ts
export type GeminiVoiceGender = 'male' | 'female';

export interface GeminiVoice {
  id: string;
  name: string;
  gender: GeminiVoiceGender;
  description: string;
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: 'Charon', name: 'Charon', gender: 'male',   description: 'Voz masculina grave e informativa' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male',   description: 'Voz masculina firme e expressiva' },
  { id: 'Orus',   name: 'Orus',   gender: 'male',   description: 'Voz masculina clara e neutra' },
  { id: 'Puck',   name: 'Puck',   gender: 'male',   description: 'Voz masculina jovem e dinâmica' },
  { id: 'Aoede',  name: 'Aoede',  gender: 'female', description: 'Voz feminina suave e melódica' },
  { id: 'Kore',   name: 'Kore',   gender: 'female', description: 'Voz feminina clara e neutra' },
  { id: 'Leda',   name: 'Leda',   gender: 'female', description: 'Voz feminina calma e narrativa' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'female', description: 'Voz feminina leve e expressiva' },
];

export const DEFAULT_GEMINI_VOICE_ID = 'Charon';

export function isValidVoiceId(id: string): boolean {
  return GEMINI_VOICES.some(v => v.id === id);
}

export function groupedVoices() {
  return {
    male:   GEMINI_VOICES.filter(v => v.gender === 'male').map(({ id, name, description }) => ({ id, name, description })),
    female: GEMINI_VOICES.filter(v => v.gender === 'female').map(({ id, name, description }) => ({ id, name, description })),
    default: DEFAULT_GEMINI_VOICE_ID,
  };
}
```

- [ ] **Step 2: Sanity-compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/gemini-voices.config.ts
git commit -m "feat: add Gemini voices config grouped by gender"
```

---

## Task 2: Allow voice override in `convertToSpeech`

**Files:**
- Modify: `src/services/tts.service.ts:276` (`convertToSpeech` signature) and `:327` (`voice_name` payload field).

- [ ] **Step 1: Add optional `voiceName` parameter**

Change `convertToSpeech` signature so callers can override the voice for a single call without mutating `AUDIO_CONFIG.VOICE_NAME`. In `src/services/tts.service.ts`:

Find:
```ts
async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
```
Replace with:
```ts
async convertToSpeech(chunk: TextChunk, voiceName?: string): Promise<Buffer> {
```

Then find the payload line:
```ts
              prebuilt_voice_config: {
                voice_name: AUDIO_CONFIG.VOICE_NAME
              }
```
Replace with:
```ts
              prebuilt_voice_config: {
                voice_name: voiceName ?? AUDIO_CONFIG.VOICE_NAME
              }
```

The Fish Audio branch (`if (this.useFishAudio) return this.fishAudioService.convertToSpeech(chunk)`) is unchanged — voice override is Gemini-only.

- [ ] **Step 2: Verify existing callers still compile**

Run: `npx tsc --noEmit`
Expected: no errors. Existing callers (`console.service.ts`, internal calls in `tts.service.ts:477`, `:675`) keep working because `voiceName` is optional.

- [ ] **Step 3: Commit**

```bash
git add src/services/tts.service.ts
git commit -m "feat(tts): accept optional voiceName in convertToSpeech"
```

---

## Task 3: Add `generateFromText` method on `TTSService`

**Files:**
- Modify: `src/services/tts.service.ts` (add new public method, near other public methods).

- [ ] **Step 1: Add imports for tmp dir handling at the top of the file (only if missing)**

`src/services/tts.service.ts` already imports `fs` from `'fs'` (`promises as fs`) and `path`. Add `os` if not already imported:

Find the imports block and ensure these exist; add what's missing:
```ts
import * as os from 'os';
```

- [ ] **Step 2: Add the method**

Add the following method as a public method on the `TTSService` class, near `convertToSpeech`:

```ts
  /**
   * Generate audio from raw text in-memory. Reuses the chunking + conversion +
   * concatenation pipeline by writing intermediate files to a temp dir, then
   * reads the concatenated file into a Buffer and cleans up.
   */
  async generateFromText(
    text: string,
    voiceName: string,
    onProgress: (event: { processed: number; total: number; status: 'running' | 'done' | 'error'; message?: string }) => void,
  ): Promise<Buffer> {
    if (!text || !text.trim()) {
      throw new Error('Texto vazio');
    }

    const chunks = this.splitTextIntoChunks(text);
    const total = chunks.length;
    onProgress({ processed: 0, total, status: 'running' });

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-gemini-job-'));
    const savedFiles: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const audioData = await this.convertToSpeech(chunk, voiceName);
        const wav = this.convertToWav(audioData);
        const filePath = await this.saveAudioFile(wav, chunk.chunkIndex, tmpDir);
        savedFiles.push(filePath);
        onProgress({ processed: i + 1, total, status: 'running' });
      }

      if (savedFiles.length === 0) {
        throw new Error('Nenhum chunk gerado');
      }

      const finalPath = await this.concatenateAudioFiles(savedFiles, tmpDir, 'audio_final.wav');
      const buffer = await fs.readFile(finalPath);
      onProgress({ processed: total, total, status: 'done' });
      return buffer;
    } catch (err: any) {
      onProgress({ processed: 0, total, status: 'error', message: err?.message ?? 'Erro desconhecido' });
      throw err;
    } finally {
      // Best-effort cleanup. Errors here should not mask the original error.
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/tts.service.ts
git commit -m "feat(tts): add generateFromText method for programmatic use"
```

---

## Task 4: Test infra (Jest)

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`

- [ ] **Step 1: Install Jest + ts-jest as dev deps**

Run: `npm install --save-dev jest ts-jest @types/jest`
Expected: install completes, no errors.

- [ ] **Step 2: Create Jest config**

`jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  roots: ['<rootDir>/tests'],
};
```

- [ ] **Step 3: Add `test` script to `package.json`**

In `package.json`, replace:
```json
"test": "echo \"Error: no test specified\" && exit 1",
```
with:
```json
"test": "jest",
```

- [ ] **Step 4: Smoke test**

Run: `npx jest --listTests`
Expected: prints empty list, exits 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js
git commit -m "chore: add jest test infrastructure"
```

---

## Task 5: `JobService` — types and creation

**Files:**
- Create: `src/web/job.service.ts`
- Create: `tests/job.service.test.ts`

- [ ] **Step 1: Write failing test for job creation**

`tests/job.service.test.ts`:
```ts
import { JobService } from '../src/web/job.service';

describe('JobService', () => {
  it('creates a job in pending state with a unique id', () => {
    const svc = new JobService(/* ttsService */ {} as any);
    const a = svc.create('hello', 'Charon', async () => {});
    const b = svc.create('hello', 'Charon', async () => {});
    expect(a).not.toEqual(b);

    const stateA = svc.get(a);
    expect(stateA?.status).toBe('pending');
    expect(stateA?.processed).toBe(0);
    expect(stateA?.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx jest tests/job.service.test.ts`
Expected: FAIL — `Cannot find module '../src/web/job.service'`.

- [ ] **Step 3: Create the service skeleton**

`src/web/job.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface ProgressEvent {
  status: 'running' | 'done' | 'error';
  processed?: number;
  total?: number;
  message?: string;
}

export interface JobState {
  id: string;
  status: JobStatus;
  processed: number;
  total: number;
  audio?: Buffer;
  errorMessage?: string;
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
  private readonly cleanupAfterMs = 30 * 60 * 1000; // 30 minutes
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
      subscribers: [],
      createdAt: new Date(),
    };
    this.jobs.set(id, state);

    const fn = runner
      ?? (typeof this.runner === 'function' ? this.runner : this.runner.run);

    // Fire-and-forget; errors handled via state.
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
    // Replay current state for late subscribers.
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
```

The constructor accepts either a function or `{ run: Runner }` so tests can pass a no-op runner without instantiating `TTSService`. In production we will inject a small adapter (Task 7).

- [ ] **Step 4: Update test to pass a no-op runner**

Replace the test body so it constructs the service correctly:
```ts
import { JobService } from '../src/web/job.service';

describe('JobService', () => {
  const noopRunner = async () => Buffer.from([]);

  it('creates a job in pending state with a unique id', async () => {
    const svc = new JobService(noopRunner);
    const a = svc.create('hello', 'Charon');
    const b = svc.create('hello', 'Charon');
    expect(a).not.toEqual(b);

    const stateA = svc.get(a);
    expect(stateA?.status === 'pending' || stateA?.status === 'running' || stateA?.status === 'done').toBe(true);
  });
});
```

- [ ] **Step 5: Run test, expect pass**

Run: `npx jest tests/job.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/web/job.service.ts tests/job.service.test.ts
git commit -m "feat(web): add JobService with in-memory state and subscriber model"
```

---

## Task 6: `JobService` — progress propagation test

**Files:**
- Modify: `tests/job.service.test.ts`

- [ ] **Step 1: Add a test that verifies subscribers receive running + done events**

Append to `tests/job.service.test.ts`:
```ts
describe('JobService progress', () => {
  it('forwards progress events to subscribers and finalizes audio', async () => {
    const events: any[] = [];
    const runner = async (
      _text: string,
      _voice: string,
      onProgress: (e: any) => void,
    ) => {
      onProgress({ status: 'running', processed: 0, total: 2 });
      onProgress({ status: 'running', processed: 1, total: 2 });
      onProgress({ status: 'running', processed: 2, total: 2 });
      return Buffer.from('audio-bytes');
    };

    const svc = new JobService(runner);
    const id = svc.create('texto', 'Charon');
    svc.subscribe(id, (e) => events.push(e));

    // wait a tick for the async runner to finish
    await new Promise((r) => setTimeout(r, 10));

    const state = svc.get(id);
    expect(state?.status).toBe('done');
    expect(state?.audio?.toString()).toBe('audio-bytes');
    expect(events.some((e) => e.status === 'done')).toBe(true);
  });

  it('marks job as error if runner throws', async () => {
    const runner = async () => {
      throw new Error('boom');
    };
    const svc = new JobService(runner);
    const id = svc.create('t', 'Charon');
    await new Promise((r) => setTimeout(r, 10));
    expect(svc.get(id)?.status).toBe('error');
    expect(svc.get(id)?.errorMessage).toBe('boom');
  });
});
```

- [ ] **Step 2: Run tests, expect pass**

Run: `npx jest tests/job.service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/job.service.test.ts
git commit -m "test(web): cover JobService progress forwarding and error path"
```

---

## Task 7: Wire `JobService` to `TTSService` via adapter

**Files:**
- Create: `src/web/tts-runner.provider.ts`

- [ ] **Step 1: Create the adapter provider**

`src/web/tts-runner.provider.ts`:
```ts
import { Provider } from '@nestjs/common';
import { TTSService } from '../services/tts.service';

export const TTS_RUNNER = Symbol('TTS_RUNNER');

export const ttsRunnerProvider: Provider = {
  provide: TTS_RUNNER,
  inject: [TTSService],
  useFactory: (tts: TTSService) => {
    // Return a function with the JobService Runner shape.
    return async (text: string, voiceName: string, onProgress: any) => {
      // Force Gemini path for the web UI.
      await tts.setUseFishAudio(false);
      return tts.generateFromText(text, voiceName, onProgress);
    };
  },
};
```

- [ ] **Step 2: Compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/tts-runner.provider.ts
git commit -m "feat(web): add TTS runner provider for JobService"
```

---

## Task 8: DTOs and `WebController`

**Files:**
- Create: `src/web/dto.ts`
- Create: `src/web/web.controller.ts`

- [ ] **Step 1: Create DTOs**

`src/web/dto.ts`:
```ts
export interface GenerateRequestBody {
  text?: unknown;
  voiceName?: unknown;
}

export interface GenerateResponse {
  jobId: string;
}

export interface VoicesResponse {
  male: Array<{ id: string; name: string; description: string }>;
  female: Array<{ id: string; name: string; description: string }>;
  default: string;
}
```

- [ ] **Step 2: Create the controller**

`src/web/web.controller.ts`:
```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JobService } from './job.service';
import { GenerateRequestBody, GenerateResponse, VoicesResponse } from './dto';
import { groupedVoices, isValidVoiceId } from '../config/gemini-voices.config';

const MAX_TEXT_LENGTH = parseInt(process.env.WEB_MAX_TEXT_LENGTH ?? '50000', 10);

@Controller()
export class WebController {
  constructor(
    @Inject(JobService) private readonly jobs: JobService,
  ) {}

  @Get('/api/voices')
  voices(): VoicesResponse {
    return groupedVoices();
  }

  @Post('/api/generate')
  generate(@Body() body: GenerateRequestBody): GenerateResponse {
    const text = typeof body?.text === 'string' ? body.text : '';
    const voiceName = typeof body?.voiceName === 'string' ? body.voiceName : '';

    if (!text.trim()) {
      throw new BadRequestException('Texto vazio');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(`Texto excede ${MAX_TEXT_LENGTH} caracteres`);
    }
    if (!isValidVoiceId(voiceName)) {
      throw new BadRequestException('Voz inválida');
    }

    const jobId = this.jobs.create(text, voiceName);
    return { jobId };
  }

  @Get('/api/jobs/:id/events')
  events(@Param('id') id: string, @Res() res: Response): void {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job não encontrado');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.status === 'done' || event.status === 'error') {
        res.end();
      }
    };

    const unsubscribe = this.jobs.subscribe(id, send);
    res.on('close', () => unsubscribe());
  }

  @Get('/api/jobs/:id/audio')
  audio(@Param('id') id: string, @Res() res: Response): void {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job não encontrado');
    if (job.status !== 'done' || !job.audio) {
      throw new NotFoundException('Áudio ainda não está pronto');
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="audio_${id}.wav"`);
    res.send(job.audio);
  }
}
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: no errors. (If `Response` from `express` is missing types, ensure `@types/express` is installed — it comes transitively with `@nestjs/platform-express`. If not: `npm install --save-dev @types/express` and commit `package.json`.)

- [ ] **Step 4: Commit**

```bash
git add src/web/dto.ts src/web/web.controller.ts
git commit -m "feat(web): add WebController with voices/generate/events/audio endpoints"
```

---

## Task 9: `WebModule` and registration

**Files:**
- Create: `src/web/web.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create the module**

`src/web/web.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { WebController } from './web.controller';
import { JobService } from './job.service';
import { ttsRunnerProvider, TTS_RUNNER } from './tts-runner.provider';
import { TTSService } from '../services/tts.service';

@Module({
  controllers: [WebController],
  providers: [
    ttsRunnerProvider,
    {
      provide: JobService,
      inject: [TTS_RUNNER],
      useFactory: (runner: any) => new JobService(runner),
    },
  ],
})
export class WebModule {}
```

Note: `TTSService` must already be exported by whatever module declares it so the `ttsRunnerProvider` can resolve it. If `TTSService` is provided in `AppModule`, importing `WebModule` from `AppModule` is enough; otherwise the providing module must `exports: [TTSService]`.

- [ ] **Step 2: Register in `AppModule`**

Open `src/app.module.ts` and add `WebModule` to its `imports` array. Read the current file first. If it looks like:
```ts
@Module({
  imports: [],
  providers: [...],
})
export class AppModule {}
```
change `imports: []` to `imports: [WebModule]` and add the import:
```ts
import { WebModule } from './web/web.module';
```

If `TTSService` is registered as a provider directly in `AppModule` (not in a sub-module), it is automatically available to imported modules — no further change needed. Verify by searching the file: `grep -n "TTSService" src/app.module.ts`.

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/web/web.module.ts src/app.module.ts
git commit -m "feat(web): register WebModule in AppModule"
```

---

## Task 10: Static file serving

**Files:**
- Create: `public/index.html` (placeholder for now — Task 12 fills it)
- Modify: `src/main.ts`

- [ ] **Step 1: Create placeholder static file**

`public/index.html`:
```html
<!doctype html><html><body>placeholder</body></html>
```

- [ ] **Step 2: Add `--web` branch to `main.ts`**

Read `src/main.ts` first. At the top of `bootstrap()`, before any flag parsing, add a check; if `--web` is present, take a different branch.

Add after the existing imports:
```ts
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
```

Then at the start of `bootstrap()` (before `const app = await NestFactory.createApplicationContext(...)`):
```ts
  if (process.argv.includes('--web')) {
    const { NestFactory } = await import('@nestjs/core');
    const httpApp = await NestFactory.create<NestExpressApplication>(AppModule);
    httpApp.useStaticAssets(join(process.cwd(), 'public'));
    const port = parseInt(process.env.WEB_PORT ?? '3000', 10);
    await httpApp.listen(port);
    console.log(`🌐 Web UI rodando em http://localhost:${port}`);
    return;
  }
```

The dynamic `await import` keeps the existing `NestFactory` import untouched — but if `NestFactory` is already imported at the top of `main.ts` (it is), just reuse it. Simpler version:

```ts
  if (process.argv.includes('--web')) {
    const httpApp = await NestFactory.create<NestExpressApplication>(AppModule);
    httpApp.useStaticAssets(join(process.cwd(), 'public'));
    const port = parseInt(process.env.WEB_PORT ?? '3000', 10);
    await httpApp.listen(port);
    console.log(`🌐 Web UI rodando em http://localhost:${port}`);
    return;
  }
```

- [ ] **Step 3: Add `web` script to `package.json`**

In `package.json` `"scripts"`, add:
```json
"web": "ts-node src/main.ts --web",
```

- [ ] **Step 4: Smoke test**

Run: `npm run web`
Expected: prints `🌐 Web UI rodando em http://localhost:3000`. In another terminal:
```bash
curl -s http://localhost:3000/ | head -1
curl -s http://localhost:3000/api/voices | head -c 200
```
Expected: first prints the placeholder HTML; second prints a JSON object with `male`, `female`, `default`. Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add public/index.html src/main.ts package.json
git commit -m "feat(web): boot HTTP server with --web flag and serve public/"
```

---

## Task 11: Test for `generateFromText` (mocked Gemini)

**Files:**
- Create: `tests/tts.generateFromText.test.ts`

- [ ] **Step 1: Write the integration test**

`tests/tts.generateFromText.test.ts`:
```ts
import { TTSService } from '../src/services/tts.service';

describe('TTSService.generateFromText', () => {
  function makeService(): TTSService {
    // Build a service stub that bypasses real DI by overriding the methods we need.
    const svc = Object.create(TTSService.prototype) as TTSService;
    (svc as any).useFishAudio = false;

    (svc as any).splitTextIntoChunks = (text: string) => {
      return [
        { text: text.slice(0, Math.ceil(text.length / 2)), chunkIndex: 0 },
        { text: text.slice(Math.ceil(text.length / 2)), chunkIndex: 1 },
      ];
    };
    (svc as any).convertToSpeech = jest.fn().mockResolvedValue(Buffer.from('rawaudio'));
    (svc as any).convertToWav = (buf: Buffer) => Buffer.concat([Buffer.from('WAV'), buf]);
    (svc as any).saveAudioFile = async (buf: Buffer, idx: number, dir: string) => {
      const fs = await import('fs');
      const path = await import('path');
      const p = path.join(dir, `chunk_${idx}.wav`);
      fs.writeFileSync(p, buf);
      return p;
    };
    (svc as any).concatenateAudioFiles = async (files: string[], dir: string, name: string) => {
      const fs = await import('fs');
      const path = await import('path');
      const out = path.join(dir, name);
      const concat = Buffer.concat(files.map((f) => fs.readFileSync(f)));
      fs.writeFileSync(out, concat);
      return out;
    };

    return svc;
  }

  it('streams progress events and returns the final buffer', async () => {
    const svc = makeService();
    const events: any[] = [];

    const buffer = await svc.generateFromText('hello world', 'Charon', (e) => events.push(e));

    expect(buffer.length).toBeGreaterThan(0);
    expect(events[0]).toEqual({ status: 'running', processed: 0, total: 2 });
    expect(events.find((e) => e.processed === 2 && e.status === 'running')).toBeTruthy();
    expect(events[events.length - 1]).toMatchObject({ status: 'done' });
  });

  it('rejects empty text', async () => {
    const svc = makeService();
    await expect(svc.generateFromText('   ', 'Charon', () => {})).rejects.toThrow(/vazio/i);
  });
});
```

- [ ] **Step 2: Run tests, expect pass**

Run: `npx jest tests/tts.generateFromText.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/tts.generateFromText.test.ts
git commit -m "test(tts): cover generateFromText progress + empty input"
```

---

## Task 12: Frontend — HTML, CSS, JS

**Files:**
- Modify: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Replace `public/index.html`**

```html
<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Audio Gemini</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main>
    <header>
      <h1>Audio Gemini</h1>
      <p class="subtitle">Geração de áudio via Google Gemini TTS</p>
    </header>

    <section id="card-generate" class="card">
      <label for="voice">Voz</label>
      <select id="voice"></select>

      <label for="text">Texto</label>
      <textarea id="text" rows="10" placeholder="Cole aqui o texto para gerar o áudio..."></textarea>
      <div class="counter"><span id="charCount">0</span> caracteres</div>

      <button id="generate" disabled>Gerar áudio</button>
    </section>

    <section id="card-progress" class="card hidden">
      <h2>Gerando áudio</h2>
      <div id="progressStatus">Iniciando...</div>
      <progress id="progressBar" max="100" value="0"></progress>
      <span id="progressPct">0%</span>
    </section>

    <section id="card-result" class="card hidden">
      <h2>Áudio gerado</h2>
      <audio id="audioPlayer" controls></audio>
      <div class="row">
        <a id="downloadBtn" href="#" download>Download</a>
        <button id="newBtn">Nova geração</button>
      </div>
    </section>

    <section id="card-error" class="card error hidden">
      <h2>Erro</h2>
      <div id="errorMessage"></div>
      <button id="retryBtn">Tentar de novo</button>
    </section>
  </main>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/styles.css`**

```css
:root {
  --bg: #0f1115;
  --panel: #171a21;
  --text: #e6e6e6;
  --muted: #9aa0a6;
  --accent: #4f8cff;
  --error: #ff5c5c;
  --border: #262a33;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
header h1 { margin: 0 0 4px; font-size: 28px; }
.subtitle { color: var(--muted); margin: 0 0 24px; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.card.error { border-color: var(--error); }
.card h2 { margin: 0 0 12px; font-size: 18px; }
.hidden { display: none; }
label { display: block; font-size: 13px; color: var(--muted); margin: 12px 0 6px; }
select, textarea, button, a#downloadBtn { font: inherit; }
select, textarea { width: 100%; background: #0c0e13; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 10px; }
textarea { resize: vertical; min-height: 180px; }
.counter { text-align: right; color: var(--muted); font-size: 12px; margin-top: 4px; }
button, a#downloadBtn { display: inline-block; background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 10px 16px; cursor: pointer; text-decoration: none; margin-top: 12px; }
button[disabled] { opacity: .5; cursor: not-allowed; }
button.secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
progress { width: 100%; height: 14px; }
#progressPct { display: inline-block; margin-left: 8px; color: var(--muted); }
#errorMessage { color: var(--error); margin-bottom: 8px; }
audio { width: 100%; margin: 8px 0; }
```

- [ ] **Step 3: Create `public/app.js`**

```js
const $ = (id) => document.getElementById(id);
const els = {
  voice: $('voice'),
  text: $('text'),
  charCount: $('charCount'),
  generate: $('generate'),
  cardProgress: $('card-progress'),
  cardResult: $('card-result'),
  cardError: $('card-error'),
  cardGenerate: $('card-generate'),
  progressStatus: $('progressStatus'),
  progressBar: $('progressBar'),
  progressPct: $('progressPct'),
  audioPlayer: $('audioPlayer'),
  downloadBtn: $('downloadBtn'),
  newBtn: $('newBtn'),
  errorMessage: $('errorMessage'),
  retryBtn: $('retryBtn'),
};

let currentJobId = null;
let currentEventSource = null;

async function loadVoices() {
  const res = await fetch('/api/voices');
  const data = await res.json();
  els.voice.innerHTML = '';
  const groups = [
    { label: 'Masculinas', items: data.male },
    { label: 'Femininas', items: data.female },
  ];
  for (const g of groups) {
    const og = document.createElement('optgroup');
    og.label = g.label;
    for (const v of g.items) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name} — ${v.description}`;
      og.appendChild(opt);
    }
    els.voice.appendChild(og);
  }
  els.voice.value = data.default;
}

function updateCount() {
  els.charCount.textContent = els.text.value.length;
  els.generate.disabled = els.text.value.trim().length === 0 || currentJobId !== null;
}

function showOnly(card) {
  for (const c of [els.cardGenerate, els.cardProgress, els.cardResult, els.cardError]) {
    c.classList.add('hidden');
  }
  card.classList.remove('hidden');
  // generate is always visible, but hide it during progress/result/error
  if (card === els.cardGenerate) els.cardGenerate.classList.remove('hidden');
}

function showProgress() {
  els.cardGenerate.classList.add('hidden');
  els.cardProgress.classList.remove('hidden');
  els.cardResult.classList.add('hidden');
  els.cardError.classList.add('hidden');
}

function showResult() {
  els.cardProgress.classList.add('hidden');
  els.cardResult.classList.remove('hidden');
}

function showError(msg) {
  els.cardProgress.classList.add('hidden');
  els.cardError.classList.remove('hidden');
  els.errorMessage.textContent = msg;
}

function reset() {
  currentJobId = null;
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
  els.cardGenerate.classList.remove('hidden');
  els.cardProgress.classList.add('hidden');
  els.cardResult.classList.add('hidden');
  els.cardError.classList.add('hidden');
  els.progressBar.value = 0;
  els.progressPct.textContent = '0%';
  els.progressStatus.textContent = 'Iniciando...';
  updateCount();
}

async function generate() {
  const text = els.text.value;
  const voiceName = els.voice.value;
  showProgress();
  els.generate.disabled = true;
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const { jobId } = await res.json();
    currentJobId = jobId;

    currentEventSource = new EventSource(`/api/jobs/${jobId}/events`);
    currentEventSource.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.status === 'running') {
        const { processed = 0, total = 0 } = data;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        els.progressBar.value = pct;
        els.progressPct.textContent = `${pct}%`;
        els.progressStatus.textContent = total > 0
          ? `Processando chunk ${processed} de ${total}...`
          : 'Preparando...';
      } else if (data.status === 'done') {
        currentEventSource.close();
        currentEventSource = null;
        const audioUrl = `/api/jobs/${jobId}/audio`;
        els.audioPlayer.src = audioUrl;
        els.downloadBtn.href = audioUrl;
        els.downloadBtn.setAttribute('download', `audio_${jobId}.wav`);
        showResult();
      } else if (data.status === 'error') {
        currentEventSource.close();
        currentEventSource = null;
        showError(data.message || 'Erro durante geração');
      }
    };
    currentEventSource.onerror = () => {
      if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
      }
      showError('Conexão perdida — recarregue a página');
    };
  } catch (e) {
    showError(e.message || String(e));
  }
}

els.text.addEventListener('input', updateCount);
els.generate.addEventListener('click', generate);
els.newBtn.addEventListener('click', () => { els.text.value = ''; reset(); });
els.retryBtn.addEventListener('click', reset);

loadVoices().then(updateCount);
```

- [ ] **Step 4: Manual smoke test (requires API keys configured in `.env`)**

Run: `npm run web`
Open `http://localhost:3000` in a browser. Check:
1. Voice dropdown shows two `optgroup`s (Masculinas / Femininas) with multiple voices each, default Charon.
2. Pasting text enables the Gerar button.
3. Clicking Gerar shows the progress card with a moving bar (assuming valid Gemini API keys are configured).
4. On completion, audio player + download appear and audio plays.
5. "Nova geração" resets to initial state.

If you don't have Gemini API keys handy, validate at least steps 1–2 and that the request reaches the server (check terminal logs for `POST /api/generate`).

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/styles.css public/app.js
git commit -m "feat(web): add UI page (HTML/CSS/JS) for audio generation"
```

---

## Task 13: Validation pass

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: CLI regression smoke test**

Run: `npm start` and immediately Ctrl+C after the prompt appears (we just want to confirm the CLI still boots without errors related to new code paths).
Expected: existing CLI menu shows up exactly as before.

- [ ] **Step 4: Web flow regression smoke test**

Run: `npm run web`, hit `http://localhost:3000`, generate a short audio with Charon, verify playback and download. Stop the server.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git status
# If anything changed during validation:
git add -A
git commit -m "chore: validation pass fixes"
```

---

## Self-Review Notes

**Spec coverage:**
- Web local on NestJS → Tasks 9, 10.
- Page served from project → Task 10, 12.
- Textarea-only input → Task 12.
- Gemini-only with grouped voices → Tasks 1, 12.
- Simple progress bar with chunk counter → Tasks 6, 12.
- Player + download in browser → Tasks 8 (audio endpoint), 12 (UI).
- CLI flow preserved → Task 10 (additive `--web` branch), Task 2 (additive optional param).
- In-memory jobs with cleanup → Task 5.
- Error handling (validation, runner failure, late subscriber) → Tasks 5, 6, 8.
- Risk: audio format → confirmed WAV (Task 8 sets `audio/wav`; Gemini path uses `convertToWav` in Task 3).

**Type consistency:** `ProgressEvent` shape matches between `JobService` (Task 5), the runner adapter (Task 7), and `generateFromText` (Task 3) — all use `{ status, processed?, total?, message? }`. `Runner` type is consistent.

**Placeholder scan:** No TBDs. Each step has either complete code or an exact command. Manual smoke test in Task 12 is acceptable because it explicitly says what to check.
