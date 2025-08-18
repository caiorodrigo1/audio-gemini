import { Module } from '@nestjs/common';
import { TTSService } from './services/tts.service';
import { ConsoleService } from './services/console.service';
import { WhiskAuthService } from './services/whisk-auth.service';
import { FishAudioService } from './services/fish-audio.service';

@Module({
  providers: [TTSService, ConsoleService, WhiskAuthService, FishAudioService],
})
export class AppModule {}