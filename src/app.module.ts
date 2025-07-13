import { Module } from '@nestjs/common';
import { TTSService } from './tts.service';
import { ConsoleService } from './console.service';

@Module({
  providers: [TTSService, ConsoleService],
})
export class AppModule {}