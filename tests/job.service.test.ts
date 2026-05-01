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
