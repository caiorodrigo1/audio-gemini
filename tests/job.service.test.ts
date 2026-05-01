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
