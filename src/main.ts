import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleService } from './services/console.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const consoleService = app.get(ConsoleService);
  
  // Verificar se foi passada a flag --fish-audio
  const useFishAudio = process.argv.includes('--fish-audio');
  
  // Verificar se foi passado o parâmetro --batches=N
  const batchesArg = process.argv.find(arg => arg.startsWith('--batches='));
  const concurrentBatches = batchesArg ? parseInt(batchesArg.split('=')[1], 10) : undefined;
  
  if (useFishAudio) {
    console.log('🐟 Modo Fish Audio ativado - usando API alternativa para geração de áudio');
  }
  
  if (concurrentBatches !== undefined) {
    if (isNaN(concurrentBatches) || concurrentBatches < 1) {
      console.error('❌ Valor inválido para --batches. Deve ser um número maior que 0.');
      process.exit(1);
    }
    console.log(`⚙️  Batches simultâneos configurados: ${concurrentBatches}`);
  }
  
  await consoleService.start(useFishAudio, concurrentBatches);
}

bootstrap();