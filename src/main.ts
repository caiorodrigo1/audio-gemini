import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleService } from './services/console.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const consoleService = app.get(ConsoleService);
  
  // Verificar se foi passada a flag --fish-audio
  const useFishAudio = process.argv.includes('--fish-audio');
  
  if (useFishAudio) {
    console.log('🐟 Modo Fish Audio ativado - usando API alternativa para geração de áudio');
  }
  
  await consoleService.start(useFishAudio);
}

bootstrap();