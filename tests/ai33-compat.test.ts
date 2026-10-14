import { createHmac } from 'crypto';
import { Ai33CompatController } from '../src/web/ai33-compat.controller';
import { JobService } from '../src/web/job.service';
import { WebhookService } from '../src/web/webhook.service';

const fakeReq: any = { protocol: 'http', get: () => 'localhost:3000' };
const fakeLibrary: any = {
  resolve: async (id: string) => (id.toLowerCase() === 'charon' ? 'charon' : null),
  defaultVoiceId: async () => 'charon',
};
const tick = () => new Promise((r) => setTimeout(r, 10));

function setup(runner: any, notify = jest.fn(async () => true)) {
  const jobs = new JobService(runner);
  const controller = new Ai33CompatController(jobs, fakeLibrary, { notify } as any);
  return { jobs, controller, notify };
}

describe('Ai33CompatController', () => {
  afterEach(() => {
    delete process.env.AI33_COMPAT_API_KEY;
  });

  it('creates a task and exposes it in the ai33 format', async () => {
    let finish!: () => void;
    const runner = (_t: string, _v: string, onProgress: any) => new Promise<Buffer>((resolve) => {
      onProgress({ status: 'running', processed: 1, total: 4 });
      finish = () => resolve(Buffer.from('mp3'));
    });
    const { controller } = setup(runner);

    const { success, task_id } = await controller.textToSpeech(
      { text: 'olá', voice_id: 'Charon', file_name: 'narracao' }, undefined, fakeReq);
    expect(success).toBe(true);

    expect(controller.task(task_id, undefined, fakeReq)).toMatchObject({
      status: 'doing', progress: 25, metadata: { audio_url: null, file_name: 'narracao' },
    });

    finish();
    await tick();
    expect(controller.task(task_id, undefined, fakeReq)).toMatchObject({
      status: 'done',
      progress: 100,
      metadata: { audio_url: `http://localhost:3000/v1/task/${task_id}/audio` },
    });
  });

  it('reports runner failures as status error', async () => {
    const { controller } = setup(async () => { throw new Error('cota esgotada'); });
    const { task_id } = await controller.textToSpeech({ text: 'x', voice_id: 'charon' }, undefined, fakeReq);
    await tick();
    expect(controller.task(task_id, undefined, fakeReq)).toMatchObject({
      status: 'error', error_message: 'cota esgotada',
    });
  });

  it('rejects unknown voices and empty text', async () => {
    const { controller } = setup(async () => Buffer.from(''));
    await expect(controller.textToSpeech({ text: 'x', voice_id: 'nope' }, undefined, fakeReq)).rejects.toThrow();
    await expect(controller.textToSpeech({ text: '  ', voice_id: 'charon' }, undefined, fakeReq)).rejects.toThrow();
  });

  it('requires xi-api-key when AI33_COMPAT_API_KEY is set', async () => {
    process.env.AI33_COMPAT_API_KEY = 'segredo';
    const { controller } = setup(async () => Buffer.from(''));
    expect(() => controller.health('errada')).toThrow();
    expect(controller.health('segredo')).toEqual({ status: 'ok' });
  });

  it('posts the finished task to receive_url exactly once', async () => {
    // generateFromText emite seu próprio 'done' antes do JobService gravar o áudio
    const runner = async (_t: string, _v: string, onProgress: any) => {
      onProgress({ status: 'done' });
      return Buffer.from('mp3');
    };
    const { controller, notify } = setup(runner);
    const { task_id } = await controller.textToSpeech(
      { text: 'x', voice_id: 'charon', receive_url: 'http://cliente/hook' }, undefined, fakeReq);
    await tick();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('http://cliente/hook', expect.objectContaining({
      id: task_id, status: 'done',
    }));
  });
});

describe('WebhookService', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  it('signs the body and retries on failure', async () => {
    process.env.WEBHOOK_SECRET = 's3';
    const post = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({});
    const svc = new WebhookService(post, async () => {});

    expect(await svc.notify('http://cliente/hook', { a: 1 })).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
    const [, body, headers] = post.mock.calls[1];
    expect(headers['X-Signature']).toBe(createHmac('sha256', 's3').update(body).digest('hex'));
  });

  it('gives up after 3 attempts', async () => {
    const post = jest.fn().mockRejectedValue(new Error('down'));
    const svc = new WebhookService(post, async () => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await svc.notify('http://cliente/hook', {})).toBe(false);
    expect(post).toHaveBeenCalledTimes(3);
  });
});
