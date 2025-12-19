import { Module } from '@nestjs/common';
import { TTSService } from './services/tts.service';
import { ConsoleService } from './services/console.service';
import { WhiskAuthService } from './services/whisk-auth.service';
import { FishAudioService } from './services/fish-audio.service';
import { VoiceSelectorService } from './services/voice-selector.service';
import { ModelSelectorService } from './services/model-selector.service';
import { LoggerService } from './services/logger.service';

@Module({
  providers: [TTSService, ConsoleService, WhiskAuthService, FishAudioService, VoiceSelectorService, ModelSelectorService, LoggerService],
})
export class AppModule {}