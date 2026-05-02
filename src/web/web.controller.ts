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
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="audio_${id}.mp3"`);
    res.send(job.audio);
  }
}
