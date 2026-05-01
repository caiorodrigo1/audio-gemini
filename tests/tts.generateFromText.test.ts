import { TTSService } from '../src/services/tts.service';

describe('TTSService.generateFromText', () => {
  function makeService(): TTSService {
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
