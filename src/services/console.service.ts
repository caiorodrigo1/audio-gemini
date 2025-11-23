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

  async promptForModeSelection(rl: readline.Interface, defaultPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('\n🚀 AUDIO GEMINI TTS - MODO AUTOMÁTICO');
      console.log('=====================================');
      console.log('');
      console.log('📁 MODOS DISPONÍVEIS:');
      console.log(`1) 🏠 Modo Padrão - CanaisAtivos: ${defaultPath}`);
      console.log('   → Escaneia automaticamente todas as pastas YT* e processa arquivos .txt');
      console.log('');
      console.log('2) 🔧 Modo Personalizado - Digitar caminho manualmente');
      console.log('   → Permite especificar qualquer pasta raiz');
      console.log('');
      console.log('💡 O sistema irá:');
      console.log('   • Encontrar todas as pastas YT, YT01, YT02, etc.');
      console.log('   • Processar todos os arquivos .txt dentro delas');
      console.log('   • Detectar automaticamente o estilo correto (vampiros, famílias, etc.)');
      console.log('   • Gerar áudio + imagens + thumbnails para cada arquivo');
      console.log('');

      rl.question('Escolha o modo (1 para Padrão, 2 para Personalizado): ', (answer: string) => {
        const trimmed = answer.trim();
        if (trimmed === '1' || trimmed === '') {
          console.log('✅ Selecionado: Modo Padrão');
          resolve(true);
          return;
        }

        if (trimmed === '2') {
          console.log('✅ Selecionado: Modo Personalizado');
          resolve(false);
          return;
        }

        console.log('⚠️  Opção inválida. Usando modo padrão.');
        resolve(true);
      });
    });
  }

  async promptForCustomPath(rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => {
      console.log('\n🔧 MODO PERSONALIZADO');
      console.log('Digite o caminho completo da pasta raiz CanaisAtivos:');
      console.log('Exemplo: D:\\Meus Canais\\Ativos');
      console.log('');

      rl.question('Caminho da pasta: ', (path: string) => {
        const trimmedPath = path.trim();
        if (!trimmedPath) {
          console.log('⚠️  Caminho vazio. Usando caminho padrão.');
          resolve('D:\\Canais Dark\\CanaisAtivos');
          return;
        }

        resolve(trimmedPath);
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

    // Perguntar se quer usar o modo padrão ou personalizado
    const defaultPath = 'D:\\Canais Dark\\CanaisAtivos';
    const useDefault = await this.promptForModeSelection(rl, defaultPath);

    let selectedPath: string;
    if (useDefault) {
      selectedPath = defaultPath;
      console.log(`\n✅ Usando caminho padrão: ${selectedPath}`);
    } else {
      selectedPath = await this.promptForCustomPath(rl);
      console.log(`\n✅ Usando caminho personalizado: ${selectedPath}`);
    }

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
    console.log(`📁 Caminho selecionado: ${selectedPath}`);
    console.log('Escaneando automaticamente todas as pastas YT* e processando arquivos .txt...');
    console.log('');
    console.log('💡 Comandos disponíveis:');
    console.log('  exit    : Sair da aplicação');
    console.log('  RENDER "C:\\caminho\\da\\pasta" : Renderizar vídeo de uma pasta específica');
    console.log('');
    console.log('💡 Configurações ativas:');
    console.log(`  • Fish Audio: ${useFishAudio ? 'Ativado' : 'Desativado'}`);
    console.log(`  • Batches simultâneos: ${finalBatches || (useFishAudio ? 1 : 5)}`);
    console.log(`  • Preset de renderização: ${finalRenderPreset || 'standard'}`);
    console.log('');
    

    const processFolderAuto = async (rootFolder: string) => {
      try {
        console.log(`\n🔍 Escaneando pasta raiz: ${rootFolder}`);

        // Verificar se a pasta existe
        const stats = await fs.stat(rootFolder);
        if (!stats.isDirectory()) {
          console.error(`❌ O caminho especificado não é uma pasta: ${rootFolder}`);
          return;
        }

        // Encontrar todas as pastas que começam com YT
        const ytFolders = await findYtFolders(rootFolder);
        if (ytFolders.length === 0) {
          console.error(`❌ Nenhuma pasta começando com "YT" encontrada em: ${rootFolder}`);
          console.log('Certifique-se de que existem pastas como YT01, YT02, etc.');
          return;
        }

        console.log(`📂 Encontradas ${ytFolders.length} pastas YT: ${ytFolders.map(f => path.basename(f)).join(', ')}`);

        // Encontrar todos os arquivos txt dentro das pastas YT
        const allTxtFiles: Array<{path: string, ytFolder: string, ytCode: string}> = [];

        for (const ytFolder of ytFolders) {
          const txtFiles = await findTxtFilesInFolder(ytFolder);
          const ytCode = path.basename(ytFolder).substring(0, 4); // Extrair YT01, YT02, etc.

          for (const txtFile of txtFiles) {
            allTxtFiles.push({
              path: txtFile,
              ytFolder: ytFolder,
              ytCode: ytCode
            });
          }
        }

        if (allTxtFiles.length === 0) {
          console.error(`❌ Nenhum arquivo .txt encontrado nas pastas YT.`);
          return;
        }

        console.log(`\n📄 Encontrados ${allTxtFiles.length} arquivo(s) txt para processamento:`);
        allTxtFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.ytCode} - ${path.basename(file.path)}`);
        });

        console.log('\n🚀 Iniciando processamento automático...\n');

        // Processar cada arquivo txt encontrado
        for (let i = 0; i < allTxtFiles.length; i++) {
          const file = allTxtFiles[i];
          console.log(`\n=== PROCESSANDO ${file.ytCode} - ${path.basename(file.path)} ===`);
          console.log(`📁 Pasta: ${path.basename(file.ytFolder)}`);

          await processFile(file.path, i + 1, allTxtFiles.length);

          // Pequeno delay entre arquivos
          if (i < allTxtFiles.length - 1) {
            console.log('\n⏳ Aguardando 3 segundos antes do próximo arquivo...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        console.log(`\n🎉 Processamento automático completo! ${allTxtFiles.length} arquivo(s) processado(s).`);

      } catch (error) {
        console.error('\n❌ Erro ao processar pasta automaticamente:', error.message);
      }
    };

    const findYtFolders = async (rootFolder: string): Promise<string[]> => {
      try {
        const entries = await fs.readdir(rootFolder, { withFileTypes: true });
        const ytFolders = entries
          .filter(entry => entry.isDirectory() && entry.name.startsWith('YT'))
          .map(entry => path.join(rootFolder, entry.name))
          .sort(); // Ordenar alfabeticamente

        return ytFolders;
      } catch (error) {
        console.error(`Erro ao listar pastas YT: ${error.message}`);
        return [];
      }
    };

    const findTxtFilesInFolder = async (folderPath: string): Promise<string[]> => {
      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const txtFiles = entries
          .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
          .map(entry => path.join(folderPath, entry.name))
          .sort(); // Ordenar alfabeticamente

        return txtFiles;
      } catch (error) {
        console.error(`Erro ao listar arquivos txt em ${folderPath}: ${error.message}`);
        return [];
      }
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

    // Iniciar processamento automático imediatamente
    try {
      await processFolderAuto(selectedPath);
      console.log('\n🎉 TODOS OS ARQUIVOS FORAM PROCESSADOS COM SUCESSO!');
      console.log('\n💡 DICAS:');
      console.log('• Use RENDER para renderizar vídeos das pastas criadas');
      console.log('• Verifique as pastas geradas para ver os arquivos criados');
      console.log('• Execute novamente o programa para processar novos arquivos');
    } catch (error) {
      console.error('\n❌ ERRO NO PROCESSAMENTO:', error.message);
    }

    // Fechar interface readline
    rl.close();
  }
}