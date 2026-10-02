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
import { VoiceLibraryService } from './voice-library.service';
import { VoicePreviewService } from './voice-preview.service';

const MAX_TEXT_LENGTH = parseInt(process.env.WEB_MAX_TEXT_LENGTH ?? '50000', 10);

@Controller()
export class WebController {
  constructor(
    @Inject(JobService) private readonly jobs: JobService,
    @Inject(VoiceLibraryService) private readonly voiceLibrary: VoiceLibraryService,
    @Inject(VoicePreviewService) private readonly voicePreview: VoicePreviewService,
  ) {}

  @Get('/api/voices')
  async voices(): Promise<VoicesResponse> {
    const [voices, defaultId] = await Promise.all([
      this.voiceLibrary.list(),
      this.voiceLibrary.defaultVoiceId(),
    ]);
    return { voices, default: defaultId };
  }

  @Get('/api/voices/:id/preview')
  async preview(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const voiceId = await this.voiceLibrary.resolve(id);
    if (!voiceId) throw new NotFoundException('Voz não encontrada');
    const wav = await this.voicePreview.get(voiceId);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(wav);
  }

  @Post('/api/generate')
  async generate(@Body() body: GenerateRequestBody): Promise<GenerateResponse> {
    const text = typeof body?.text === 'string' ? body.text : '';
    const voiceName = typeof body?.voiceName === 'string' ? body.voiceName : '';

    if (!text.trim()) {
      throw new BadRequestException('Texto vazio');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(`Texto excede ${MAX_TEXT_LENGTH} caracteres`);
    }
    const voiceId = await this.voiceLibrary.resolve(voiceName);
    if (!voiceId) {
      throw new BadRequestException('Voz inválida');
    }

    const jobId = this.jobs.create(text, voiceId);
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
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="audio_${id}.mp3"`);
    res.send(job.audio);
  }
}
