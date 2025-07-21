import { Injectable } from '@nestjs/common';
import { TTSService } from './tts.service';
import * as readline from 'readline';
import * as path from 'path';
import { promises as fs } from 'fs';

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

  start(): void {
    // Conectar o TTS service com este console service
    this.ttsService.setConsoleService(this);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('=== Audio Gemini TTS Console ===');
    console.log('Digite o path do txt para converter em áudio (digite "exit" para sair):');
    console.log('Para múltiplos arquivos: separe os caminhos com vírgula');
    console.log('  Exemplo: "C:\\arquivo1.txt", "C:\\arquivo2.txt", "C:\\arquivo3.txt"');
    console.log('Para renderizar vídeo de uma pasta existente: RENDER "C:\\caminho\\da\\pasta"');
    console.log('Os arquivos de áudio serão salvos nas respectivas pastas');
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

    const createDateTimeFolder = async (baseDir: string = 'D:\\Canais Dark'): Promise<string> => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      const sequentialNumber = await getNextSequentialNumber(baseDir);
      const sequentialPart = String(sequentialNumber).padStart(2, '0');
      
      const folderName = `${sequentialPart} - ${year}_${month}_${day} ${hours}_${minutes}`;
      return path.join(baseDir, folderName);
    };

    const processText = async (text: string, baseDir?: string, filePath?: string) => {
      try {
        console.log('\nProcessando texto...');
        const outputDir = await createDateTimeFolder(baseDir);
        const savedFiles = await this.ttsService.processTextToSpeech(text, outputDir, filePath);
        
        console.log('\n✅ Conversão concluída com sucesso!');
        console.log(`📁 Arquivos salvos em: ${outputDir}`);
        console.log(`🎵 Total de arquivos: ${savedFiles.length}`);
        console.log('\nArquivos criados:');
        savedFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${path.basename(file)}`);
        });
        console.log('');
        
      } catch (error) {
        console.error('\n❌ Erro ao processar texto:', error.message);
        console.log('');
      }
    };

    promptUser();
  }
}