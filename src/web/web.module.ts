import { Module } from '@nestjs/common';
import { WebController } from './web.controller';
import { JobService } from './job.service';
import { ttsRunnerProvider, TTS_RUNNER } from './tts-runner.provider';

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
