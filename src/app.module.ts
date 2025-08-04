import { Module } from '@nestjs/common';
import { TTSService } from './services/tts.service';
import { ConsoleService } from './services/console.service';

@Module({
  providers: [TTSService, ConsoleService],
})
export class AppModule {}