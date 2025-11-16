import { Injectable } from '@nestjs/common';
import { TTSService } from './tts.service';
import * as readline from 'readline';
import * as path from 'path';
import { promises as fs } from 'fs';
import { RenderPreset } from '../config/render.config';

@Injectable()
export class ConsoleService {
  constructor(private readonly ttsService: TTSService) {}

  async promptForNewToken(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      console.log('\n🔑 O token atual expirou ou é inválido.');
      console.log('Por favor, insira um novo token do Google Labs Whisk:');
      console.log('(Você pode obter um novo token em: https://labs.google/whisk)');
      
      rl.question('Novo token: ', (token: string) => {
        rl.close();
        const trimmedToken = token.trim();
        if (trimmedToken.length > 10) {
          console.log('🔄 Token recebido, atualizando...');
        }
        resolve(trimmedToken);
      });
    });
  }

  async promptForBatches(rl: readline.Interface, useFishAudio: boolean): Promise<number | undefined> {
    return new Promise((resolve) => {
      const defaultBatch = useFishAudio ? 1 : 5;
      console.log('\n⚙️  CONFIGURAÇÃO DE BATCHES SIMULTÂNEOS');
      console.log(`Quantos batches simultâneos de áudio deseja usar?`);
      console.log(`   Padrão: ${defaultBatch} (pressione Enter para usar o padrão)`);
      console.log(`   Recomendado: ${useFishAudio ? '1-2' : '3-8'} batches`);
      console.log(`   Digite um número ou pressione Enter para padrão:`);
      
      rl.question('Batches: ', (answer: string) => {
        const trimmed = answer.trim();
        if (!trimmed) {
          console.log(`✅ Usando valor padrão: ${defaultBatch} batches`);
          resolve(undefined); // Usará o padrão
          return;
        }
        
        const batches = parseInt(trimmed, 10);
        if (isNaN(batches) || batches < 1) {
          console.log(`⚠️  Valor inválido. Usando padrão: ${defaultBatch} batches`);
          resolve(undefined);
          return;
        }
        
        console.log(`✅ Configurado: ${batches} batches simultâneos`);
        resolve(batches);
      });
    });
  }

  async promptForRenderPreset(rl: readline.Interface): Promise<RenderPreset> {
    return new Promise((resolve) => {
      console.log('\n🎬 CONFIGURAÇÃO DE QUALIDADE DE RENDERIZAÇÃO');
      console.log('Qual preset de renderização deseja usar?');
      console.log('   1) Standard (padrão) - Preset p4, tune hq, alta qualidade');
      console.log('   2) Fast - Preset p1, tune ll, renderização 2-3x mais rápida');
      console.log('   Digite 1 ou 2 (padrão: 1):');
      
      rl.question('Preset: ', (answer: string) => {
        const trimmed = answer.trim().toLowerCase();
        if (!trimmed || trimmed === '1') {
          console.log('✅ Usando preset: Standard (p4, hq)');
          resolve('standard');
          return;
        }
        
        if (trimmed === '2') {
          console.log('✅ Usando preset: Fast (p1, ll) - renderização otimizada para velocidade');
          resolve('fast');
          return;
        }
        
        console.log('⚠️  Opção inválida. Usando padrão: Standard');
        resolve('standard');
      });
    });
  }

  async start(useFishAudio: boolean = false, concurrentBatches?: number, renderPreset?: RenderPreset): Promise<void> {
    // Conectar o TTS service com este console service e informar se deve usar Fish Audio
    this.ttsService.setConsoleService(this);
    await this.ttsService.setUseFishAudio(useFishAudio);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Se não foram passados via linha de comando, perguntar interativamente
    let finalBatches = concurrentBatches;
    let finalRenderPreset = renderPreset;

    if (concurrentBatches === undefined) {
      finalBatches = await this.promptForBatches(rl, useFishAudio);
    } else {
      console.log(`⚙️  Batches configurados via linha de comando: ${concurrentBatches}`);
    }
    
    if (renderPreset === undefined) {
      finalRenderPreset = await this.promptForRenderPreset(rl);
    } else {
      console.log(`🎬 Preset de renderização configurado via linha de comando: ${renderPreset}`);
    }

    // Configurar quantidade de batches simultâneos
    if (finalBatches !== undefined) {
      this.ttsService.setConcurrentBatches(finalBatches);
    }
    
    // Configurar preset de renderização
    if (finalRenderPreset !== undefined) {
      this.ttsService.setRenderPreset(finalRenderPreset);
    }

    console.log('\n=== Audio Gemini TTS Console ===');
    console.log('Digite o path do txt para converter em áudio (digite "exit" para sair):');
    console.log('Para múltiplos arquivos: separe os caminhos com vírgula');
    console.log('  Exemplo: "C:\\arquivo1.txt", "C:\\arquivo2.txt", "C:\\arquivo3.txt"');
    console.log('Para renderizar vídeo de uma pasta existente: RENDER "C:\\caminho\\da\\pasta"');
    console.log('Os arquivos de áudio serão salvos nas respectivas pastas');
    console.log('');
    console.log('💡 Dica: Você também pode configurar via linha de comando:');
    console.log('  --batches=N          : Define quantidade de batches simultâneos');
    console.log('  --render-preset=fast  : Renderização rápida');
    console.log('  --fish-audio         : Usa Fish Audio');
    console.log('');
    
    let multilineMode = false;
    let multilineText = '';

    const promptUser = () => {
      const prompt = multilineMode ? 'Continue (ou digite "END" para finalizar): ' : 'Digite o texto: ';
      
      rl.question(prompt, async (input: string) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Até logo!');
          rl.close();
          return;
        }

        // Verificar se é comando RENDER
        if (input.trim().toUpperCase().startsWith('RENDER')) {
          await processRender(input);
          promptUser();
          return;
        }

        // Verificar se são arquivos (caminhos entre aspas OU extensão de arquivo)
        if (input.includes('"') || input.trim().endsWith('.txt')) {
          if (!input.includes('"')) {
            // Se é um arquivo sem aspas, processar diretamente
            await processFile(input.trim());
          } else {
            await processFiles(input);
          }
          promptUser();
          return;
        }

        // Verificar se está iniciando modo multiline (texto longo)
        if (!multilineMode && input.length > 1000) {
          multilineMode = true;
          multilineText = input;
          promptUser();
          return;
        }

        // Verificar se está finalizando modo multiline
        if (multilineMode && input.trim().toLowerCase() === 'end') {
          multilineMode = false;
          const finalText = multilineText;
          multilineText = '';
          
          await processText(finalText);
          promptUser();
          return;
        }

        // Adicionar ao texto multiline
        if (multilineMode) {
          multilineText += '\n' + input;
          promptUser();
          return;
        }

        // Processar texto normal
        if (!input.trim()) {
          console.log('Por favor, digite um texto válido.');
          promptUser();
          return;
        }

        await processText(input);
        promptUser();
      });
    };

    const parseFilePaths = (input: string): string[] => {
      // Extrair todos os caminhos entre aspas
      const pathRegex = /"([^"]+)"/g;
      const paths: string[] = [];
      let match;
      
      while ((match = pathRegex.exec(input)) !== null) {
        paths.push(match[1]);
      }
      
      return paths;
    };

    const processRender = async (input: string) => {
      try {
        // Extrair o caminho da pasta do comando RENDER
        const match = input.match(/RENDER\s+"([^"]+)"/i);
        if (!match) {
          console.error('\n❌ Formato inválido para comando RENDER.');
          console.log('Use: RENDER "C:\\caminho\\da\\pasta"');
          console.log('');
          return;
        }
        
        const folderPath = match[1];
        console.log(`\n🎬 Tentando renderizar vídeo da pasta: ${folderPath}`);
        
        const videoPath = await this.ttsService.retryVideoRendering(folderPath);
        
        console.log(`\n✅ Vídeo renderizado com sucesso!`);
        console.log(`📹 Arquivo: ${videoPath}`);
        console.log('');
        
      } catch (error) {
        console.error('\n❌ Erro ao renderizar vídeo:', error.message);
        console.log('');
      }
    };

    const processFiles = async (input: string) => {
      const filePaths = parseFilePaths(input);
      
      if (filePaths.length === 0) {
        console.error('\n❌ Nenhum caminho de arquivo válido encontrado.');
        console.log('Use aspas ao redor de cada caminho: "C:\\arquivo1.txt", "C:\\arquivo2.txt"');
        console.log('');
        return;
      }

      console.log(`\n📁 ${filePaths.length} arquivo(s) detectado(s) para processamento...`);
      
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        console.log(`\n=== PROCESSANDO ARQUIVO ${i + 1}/${filePaths.length} ===`);
        await processFile(filePath, i + 1, filePaths.length);
        
        // Pequeno delay entre arquivos
        if (i < filePaths.length - 1) {
          console.log('\n⏳ Aguardando 3 segundos antes do próximo arquivo...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      console.log(`\n🎉 Processamento completo! ${filePaths.length} arquivo(s) processado(s).`);
    };

    const processFile = async (filePath: string, fileNumber?: number, totalFiles?: number) => {
      try {
        const fileInfo = fileNumber && totalFiles ? ` [${fileNumber}/${totalFiles}]` : '';
        console.log(`\nLendo arquivo${fileInfo}: ${filePath}`);
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        console.log(`Arquivo lido com ${fileContent.length} caracteres`);
        
        // Usar o diretório do arquivo como base
        const baseDir = path.dirname(filePath);
        await processText(fileContent, baseDir, filePath);
        
      } catch (error) {
        console.error('\n❌ Erro ao ler arquivo:', error.message);
        console.log('Verifique se o caminho está correto e o arquivo existe.');
        console.log('');
      }
    };

    const getNextSequentialNumber = async (baseDir: string): Promise<number> => {
      try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        const folders = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .filter(name => /^\d{2}/.test(name)) // Pastas que começam com 2 dígitos
          .map(name => {
            const match = name.match(/^(\d{2})/);
            return match ? parseInt(match[1], 10) : 0;
          });
        
        if (folders.length === 0) return 1;
        return Math.max(...folders) + 1;
      } catch (error) {
        // Se a pasta base não existe, retorna 1
        return 1;
      }
    };

    const createDateTimeFolder = async (baseDir: string = 'D:\\Canais Dark', fileName?: string): Promise<string> => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      const sequentialNumber = await getNextSequentialNumber(baseDir);
      const sequentialPart = String(sequentialNumber).padStart(2, '0');
      
      let folderName = `${sequentialPart} - ${year}_${month}_${day} ${hours}_${minutes}`;
      
      const finalPath = path.join(baseDir, folderName);
      console.log(`🗂️ Caminho final da pasta: "${finalPath}"`);
      return finalPath;
    };

    const processText = async (text: string, baseDir?: string, filePath?: string) => {
      try {
        console.log('\nProcessando texto...');
        const outputDir = await createDateTimeFolder(baseDir, filePath);
        const savedFiles = await this.ttsService.processTextToSpeech(text, outputDir, filePath);
        
        console.log('\n✅ Conversão concluída com sucesso!');
        console.log(`📁 Arquivos salvos em: ${outputDir}`);
        console.log(`🎵 Total de arquivos: ${savedFiles.length}`);
        console.log('\nArquivos criados:');
        savedFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${path.basename(file)}`);
        });
        
        // Mover arquivo de texto original para dentro da pasta criada
        if (filePath) {
          try {
            const originalFileName = path.basename(filePath);
            const newFilePath = path.join(outputDir, originalFileName);
            
            console.log(`\n📂 Movendo arquivo de roteiro para a pasta criada...`);
            await fs.rename(filePath, newFilePath);
            console.log(`✅ Arquivo "${originalFileName}" movido para: ${path.basename(outputDir)}`);
          } catch (moveError) {
            console.warn(`⚠️ Não foi possível mover o arquivo de roteiro: ${moveError.message}`);
          }
        }
        
        console.log('');
        
      } catch (error) {
        console.error('\n❌ Erro ao processar texto:', error.message);
        console.log('');
      }
    };

    promptUser();
  }
}