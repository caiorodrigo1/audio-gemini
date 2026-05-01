import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleService } from './services/console.service';
import { RenderPreset } from './config/render.config';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const consoleService = app.get(ConsoleService);

  // Verificar se foi passada a flag --audio-only (modo apenas áudio)
  const audioOnly = process.argv.includes('--audio-only');

  // Verificar se foi passada a flag --fish-audio
  const useFishAudio = process.argv.includes('--fish-audio');
  
  // Verificar se foi passado o parâmetro --batches=N
  const batchesArg = process.argv.find(arg => arg.startsWith('--batches='));
  const concurrentBatches = batchesArg ? parseInt(batchesArg.split('=')[1], 10) : undefined;
  
  // Verificar se foi passado o parâmetro --render-preset=standard|fast
  const renderPresetArg = process.argv.find(arg => arg.startsWith('--render-preset='));
  let renderPreset: RenderPreset | undefined = undefined;
  if (renderPresetArg) {
    const presetValue = renderPresetArg.split('=')[1];
    if (presetValue === 'standard' || presetValue === 'fast') {
      renderPreset = presetValue as RenderPreset;
    } else {
      console.error('❌ Valor inválido para --render-preset. Deve ser "standard" ou "fast".');
      process.exit(1);
    }
  }
  
  // Verificar se foi passado o parâmetro --path= ou --custom-path=
  const pathArg = process.argv.find(arg => arg.startsWith('--path=') || arg.startsWith('--custom-path='));
  const customPath = pathArg ? pathArg.split('=')[1] : undefined;
  
  // Verificar se foi passado o parâmetro --render= para renderizar apenas
  const renderArg = process.argv.find(arg => arg.startsWith('--render='));
  const renderPath = renderArg ? renderArg.split('=')[1] : undefined;
  
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
  
  if (renderPreset === 'fast') {
    console.log('⚡ Modo de renderização rápida ativado (preset p1) - reduz tempo pela metade mantendo qualidade');
  }
  
  if (customPath) {
    console.log(`📁 Caminho personalizado fornecido: ${customPath}`);
  }
  
  // Se --audio-only foi passado, modo apenas áudio
  if (audioOnly) {
    console.log('🎵 Modo AUDIO ONLY ativado - apenas geração de áudio a partir de texto');
    await consoleService.audioOnly(useFishAudio);
  }
  // Se --render foi passado, apenas renderizar
  else if (renderPath) {
    await consoleService.renderOnly(renderPath, renderPreset);
  } else {
    await consoleService.start(useFishAudio, concurrentBatches, renderPreset, customPath);
  }
}

bootstrap();