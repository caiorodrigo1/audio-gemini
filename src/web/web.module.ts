import { Module } from '@nestjs/common';
import { WebController } from './web.controller';
import { Ai33CompatController } from './ai33-compat.controller';
import { WebhookService } from './webhook.service';
import { FavoritesService } from './favorites.service';
import { JobService } from './job.service';
import { VoiceLibraryService } from './voice-library.service';
import { VoicePreviewService } from './voice-preview.service';
import { ttsRunnerProvider, TTS_RUNNER } from './tts-runner.provider';
import { TTSService } from '../services/tts.service';
import { WhiskAuthService } from '../services/whisk-auth.service';
import { FishAudioService } from '../services/fish-audio.service';
import { VoiceSelectorService } from '../services/voice-selector.service';
import { ModelSelectorService } from '../services/model-selector.service';
import { LoggerService } from '../services/logger.service';

@Module({
  controllers: [WebController, Ai33CompatController],
  providers: [
    TTSService,
    WhiskAuthService,
    FishAudioService,
    VoiceSelectorService,
    ModelSelectorService,
    LoggerService,
    VoiceLibraryService,
    VoicePreviewService,
    ttsRunnerProvider,
    { provide: WebhookService, useFactory: () => new WebhookService() },
    { provide: FavoritesService, useFactory: () => new FavoritesService() },
    {
      provide: JobService,
      inject: [TTS_RUNNER],
      useFactory: (runner: any) => new JobService(runner),
    },
  ],
})
export class WebModule {}
