import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TTSService } from './tts.service';
import { promises as fs } from 'fs';
import * as path from 'path';

async function testTTS() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const ttsService = app.get(TTSService);
    
    // Ler o texto do arquivo
    const textPath = path.join(process.cwd(), 'test-text.txt');
    const text = await fs.readFile(textPath, 'utf8');
    
    console.log('=== Teste do TTS ===');
    console.log(`Texto tem ${text.length} caracteres`);
    console.log('Iniciando conversão...\n');
    
    // Processar o texto
    const outputDir = path.join('D:', 'Canais Dark', `wedding_story_${Date.now()}`);
    const savedFiles = await ttsService.processTextToSpeech(text, outputDir);
    
    console.log('\n✅ Conversão concluída!');
    console.log(`📁 Arquivos salvos em: ${outputDir}`);
    console.log(`🎵 Total de arquivos: ${savedFiles.length}`);
    console.log('\nArquivos criados:');
    savedFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${path.basename(file)}`);
    });
    
    await app.close();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testTTS();