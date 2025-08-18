import { Module } from '@nestjs/common';
import { TTSService } from './services/tts.service';
import { ConsoleService } from './services/console.service';
import { WhiskAuthService } from './services/whisk-auth.service';

@Module({
  providers: [TTSService, ConsoleService, WhiskAuthService],
})
export class AppModule {}