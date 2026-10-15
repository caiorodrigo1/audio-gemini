import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JobService, JobState } from './job.service';
import { VoiceLibraryService } from './voice-library.service';
import { WebhookService } from './webhook.service';

const MAX_TEXT_LENGTH = parseInt(process.env.WEB_MAX_TEXT_LENGTH ?? '50000', 10);

export interface Ai33Task {
  id: string;
  type: 'tts';
  status: 'doing' | 'done' | 'error';
  progress: number;
  error_message: string | null;
  metadata: { audio_url: string | null; file_name: string | null };
}

/**
 * Subconjunto da API do ai33.pro (/v3/text-to-speech + /v1/task/:id),
 * para que clientes como o historia-clips usem o Gemini TTS só trocando a URL base.
 * Se AI33_COMPAT_API_KEY estiver definida, exige o header xi-api-key igual a ela.
 */
@Controller()
export class Ai33CompatController {
  constructor(
    @Inject(JobService) private readonly jobs: JobService,
    @Inject(VoiceLibraryService) private readonly voiceLibrary: VoiceLibraryService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Get('/v1/health-check')
  health(@Headers('xi-api-key') apiKey?: string) {
    checkApiKey(apiKey);
    return { status: 'ok' };
  }

  @Post('/v3/text-to-speech')
  @UseInterceptors(NoFilesInterceptor())
  async textToSpeech(
    @Body() body: Record<string, unknown>,
    @Headers('xi-api-key') apiKey: string | undefined,
    @Req() req: Request,
  ) {
    checkApiKey(apiKey);

    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) throw new BadRequestException({ success: false, error: 'text vazio' });
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException({ success: false, error: `text excede ${MAX_TEXT_LENGTH} caracteres` });
    }

    const requestedVoice = typeof body?.voice_id === 'string' && body.voice_id.trim()
      ? body.voice_id.trim()
      : await this.voiceLibrary.defaultVoiceId();
    const voiceId = await this.voiceLibrary.resolve(requestedVoice);
    if (!voiceId) throw new BadRequestException({ success: false, error: `voice_id inválido: ${requestedVoice}` });

    const receiveUrl = typeof body?.receive_url === 'string' ? body.receive_url.trim() : '';
    if (receiveUrl && !/^https?:\/\//i.test(receiveUrl)) {
      throw new BadRequestException({ success: false, error: 'receive_url deve ser http(s)' });
    }

    const id = this.jobs.create(text, voiceId);
    const job = this.jobs.get(id)!;
    if (typeof body?.file_name === 'string' && body.file_name.trim()) {
      job.fileName = body.file_name.trim();
    }

    if (receiveUrl) {
      const baseUrl = publicBaseUrl(req);
      // Olha o estado do job, não o evento: o runner emite seu próprio 'done'
      // antes de o JobService gravar o áudio.
      const unsubscribe = this.jobs.subscribe(id, () => {
        if (job.status !== 'done' && job.status !== 'error') return;
        // subscribe pode disparar de forma síncrona (replay), então adia o unsubscribe
        setImmediate(() => unsubscribe());
        void this.webhooks.notify(receiveUrl, toTask(job, baseUrl));
      });
    }

    return { success: true, task_id: id };
  }

  @Get('/v1/task/:id')
  task(@Param('id') id: string, @Headers('xi-api-key') apiKey: string | undefined, @Req() req: Request): Ai33Task {
    checkApiKey(apiKey);
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException({ success: false, error: 'task não encontrada' });
    return toTask(job, publicBaseUrl(req));
  }

  // Sem xi-api-key: o cliente baixa o audio_url direto, e o id (UUID) já é o segredo.
  @Get('/v1/task/:id/audio')
  audio(@Param('id') id: string, @Res() res: Response): void {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('task não encontrada');
    if (job.status !== 'done' || !job.audio) throw new NotFoundException('áudio ainda não está pronto');
    const fileName = (job.fileName ?? `audio_${id}`).replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.mp3"`);
    res.send(job.audio);
  }
}

function checkApiKey(received: string | undefined): void {
  const expected = process.env.AI33_COMPAT_API_KEY;
  if (expected && received !== expected) {
    throw new UnauthorizedException({ success: false, error: 'xi-api-key inválida' });
  }
}

function publicBaseUrl(req: Request): string {
  return (process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

export function toTask(job: JobState, baseUrl: string): Ai33Task {
  const done = job.status === 'done';
  return {
    id: job.id,
    type: 'tts',
    status: done ? 'done' : job.status === 'error' ? 'error' : 'doing',
    progress: done ? 100 : job.total > 0 ? Math.floor((job.processed / job.total) * 100) : 0,
    error_message: job.status === 'error' ? job.errorMessage ?? 'Erro desconhecido' : null,
    metadata: {
      audio_url: done ? `${baseUrl}/v1/task/${job.id}/audio` : null,
      file_name: job.fileName ?? null,
    },
  };
}
