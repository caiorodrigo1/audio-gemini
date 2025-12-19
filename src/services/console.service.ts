import { Injectable } from '@nestjs/common';
import { TTSService } from './tts.service';
import * as readline from 'readline';
import * as path from 'path';
import { promises as fs } from 'fs';
import { RenderPreset } from '../config/render.config';
import { DELAYS } from '../constants';

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

  async renderOnly(folderPath: string, renderPreset?: RenderPreset): Promise<void> {
    console.log('\n🎬 MODO RENDERIZAÇÃO APENAS');
    console.log('===========================');
    console.log(`📁 Pasta para renderizar: ${folderPath}`);
    console.log('');

    // Conectar o TTS service com este console service
    this.ttsService.setConsoleService(this);

    // Configurar preset de renderização se fornecido
    if (renderPreset !== undefined) {
      this.ttsService.setRenderPreset(renderPreset);
      console.log(`🎬 Preset de renderização: ${renderPreset}`);
    } else {
      // Usar preset fast por padrão para velocidade
      this.ttsService.setRenderPreset('fast');
      console.log(`🎬 Preset de renderização: fast (padrão)`);
    }

    console.log('');

    try {
      // Verificar se a pasta existe
      try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
          console.error(`❌ O caminho especificado não é uma pasta: ${folderPath}`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Pasta não encontrada: ${folderPath}`);
        console.error(`   Erro: ${error.message}`);
        process.exit(1);
      }

      // Renderizar o vídeo
      console.log('🎬 Iniciando renderização do vídeo...');
      const videoPath = await this.ttsService.retryVideoRendering(folderPath);
      
      console.log(`\n✅ Renderização concluída com sucesso!`);
      console.log(`📁 Vídeo salvo em: ${videoPath}`);
      console.log('');

    } catch (error) {
      console.error(`\n❌ Erro ao renderizar vídeo: ${error.message}`);
      process.exit(1);
    }
  }


  async promptForModeSelection(rl: readline.Interface, defaultPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const options = [
        {
          label: `🏠 Modo Padrão - CanaisAtivos: ${defaultPath}`,
          description: '   → Escaneia automaticamente todas as pastas YT* e processa arquivos .txt',
          value: true
        },
        {
          label: '🔧 Modo Personalizado - Digitar caminho manualmente',
          description: '   → Permite especificar qualquer pasta raiz',
          value: false
        }
      ];

      let selectedIndex = 0;
      let isFirstRender = true;

      const renderMenu = () => {
        console.clear();

        console.log('\n🚀 AUDIO GEMINI TTS - MODO AUTOMÁTICO');
        console.log('=====================================');
        console.log('');
        console.log('📁 MODOS DISPONÍVEIS:');
        console.log('');
        console.log('💡 O sistema irá:');
        console.log('   • Encontrar todas as pastas YT, YT01, YT02, etc.');
        console.log('   • Processar todos os arquivos .txt dentro delas');
        console.log('   • Detectar automaticamente o estilo correto (vampiros, famílias, etc.)');
        console.log('   • Gerar áudio + imagens + thumbnails para cada arquivo');
        console.log('');

        options.forEach((option, index) => {
          const pointer = index === selectedIndex ? '👉 ' : '   ';
          console.log(`${pointer}${option.label}`);
          console.log(`${option.description}`);
          console.log('');
        });

        console.log('Use ↑↓ para navegar, ENTER para selecionar, ESC para sair');
      };

      const handleKeyPress = (key: Buffer) => {
        const keyStr = key.toString();
        if (keyStr === '\u001b[A') { // Seta para cima
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
          renderMenu();
        } else if (keyStr === '\u001b[B') { // Seta para baixo
          selectedIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
          renderMenu();
        } else if (keyStr === '\r' || keyStr === '\n') { // Enter
          const selectedOption = options[selectedIndex];
          console.log(`\n✅ Selecionado: ${selectedOption.label.split(' - ')[0]}`);
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', handleKeyPress);
          resolve(selectedOption.value);
        } else if (keyStr === '\u001b') { // ESC
          console.log('\n⚠️  Saindo... Usando modo padrão.');
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', handleKeyPress);
          resolve(true);
        }
      };

      // Configurar modo raw para capturar setas
      process.stdin.setRawMode(true);
      process.stdin.on('data', handleKeyPress);

      // Renderizar menu inicial
      renderMenu();

      // Timeout de segurança (5 minutos)
      setTimeout(() => {
        console.log('\n⏰ Timeout - Usando modo padrão.');
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', handleKeyPress);
        resolve(true);
      }, 300000); // 5 minutos
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


  async start(useFishAudio: boolean = false, concurrentBatches?: number, renderPreset?: RenderPreset, customPath?: string): Promise<void> {
    // Conectar o TTS service com este console service e informar se deve usar Fish Audio
    this.ttsService.setConsoleService(this);
    await this.ttsService.setUseFishAudio(useFishAudio);

    const defaultPath = 'D:\\Canais Dark\\CanaisAtivos';
    
    // Usar caminho personalizado se fornecido, senão usar padrão
    const selectedPath = customPath || defaultPath;
    
    console.log('\n🚀 AUDIO GEMINI TTS - INICIANDO AUTOMATICAMENTE');
    console.log('================================================');
    console.log(`📁 Caminho selecionado: ${selectedPath}`);
    if (customPath) {
      console.log('   (Caminho personalizado fornecido via --path=)');
    } else {
      console.log('   (Caminho padrão - use --path="caminho" para personalizar)');
    }
    console.log('');
    console.log('💡 Para usar um caminho personalizado, execute:');
    console.log('   npm start -- --path="D:\\Seu\\Caminho\\Personalizado"');
    console.log('   ou');
    console.log('   npm start -- --custom-path="D:\\Seu\\Caminho\\Personalizado"');
    console.log('');

    // Detectar automaticamente o número máximo de batches baseado nas API keys disponíveis
    let finalBatches = concurrentBatches;
    let finalRenderPreset = renderPreset;

    if (concurrentBatches === undefined) {
      // Detectar automaticamente quantas API keys estão configuradas
      const apiKeysCount = this.ttsService.getApiKeysCount();
      finalBatches = apiKeysCount;

      console.log(`🔑 API keys detectadas: ${apiKeysCount}`);
      console.log(`⚙️  Batches simultâneos configurados automaticamente: ${finalBatches}`);
      console.log(`💡 Cada batch usará uma API key diferente para processamento paralelo`);
    } else {
      console.log(`⚙️  Batches configurados via linha de comando: ${concurrentBatches}`);
    }

    if (renderPreset === undefined) {
      // Usar automaticamente o preset fast (opção 2) para velocidade otimizada
      finalRenderPreset = 'fast';
      console.log(`🎬 Preset de renderização configurado automaticamente: Fast (p1, ll) - 2-3x mais rápido`);
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

    console.log('💡 Configurações ativas:');
    console.log(`  • Fish Audio: ${useFishAudio ? 'Ativado' : 'Desativado'}`);
    console.log(`  • API Keys disponíveis: ${this.ttsService.getApiKeysCount()}`);
    console.log(`  • Batches simultâneos: ${finalBatches || (useFishAudio ? 1 : this.ttsService.getApiKeysCount())}`);
    console.log(`  • Preset de renderização: ${finalRenderPreset || 'standard'}`);
    console.log('');
    console.log('Escaneando automaticamente todas as pastas YT* e processando arquivos .txt...');
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
            const delaySeconds = (DELAYS.BETWEEN_FILES / 1000).toFixed(0);
            console.log(`\n⏳ Aguardando ${delaySeconds} segundos antes do próximo arquivo...`);
            await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_FILES));
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
        await processText(fileContent, baseDir, filePath, fileNumber, totalFiles);
        
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

    const processText = async (text: string, baseDir?: string, filePath?: string, fileNumber?: number, totalFiles?: number) => {
      try {
        console.log('\nProcessando texto...');
        const outputDir = await createDateTimeFolder(baseDir, filePath);
        const savedFiles = await this.ttsService.processTextToSpeech(text, outputDir, filePath, fileNumber, totalFiles);
        
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

    // Interface para interações simples no console (menu final)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let keepRunning = true;

    while (keepRunning) {
      // Iniciar processamento automático
      try {
        await processFolderAuto(selectedPath);
        console.log('\n🎉 TODOS OS ARQUIVOS FORAM PROCESSADOS COM SUCESSO!');

        // Resumo das API keys esgotadas nesta execução
        const summary = this.ttsService.getExhaustedKeysSummary();
        console.log(`\n🔑 API keys esgotadas nesta execução: ${summary.exhaustedCount}/${summary.totalKeys}`);
        if (summary.exhaustedCount > 0) {
          console.log(`   Índices das keys esgotadas: ${summary.exhaustedIndexes.map(i => i + 1).join(', ')}`);
        }

        console.log('\n💡 DICAS:');
        console.log('• Use RENDER para renderizar vídeos das pastas criadas');
        console.log('• Verifique as pastas geradas para ver os arquivos criados');
        console.log('• Adicione novos arquivos .txt nas pastas YT* para novo processamento');
      } catch (error) {
        console.error('\n❌ ERRO NO PROCESSAMENTO:', error.message);
      }

      // Menu final: continuar ou sair
      const answer: string = await new Promise((resolve) => {
        console.log('\nO que você deseja fazer agora?');
        console.log('  1 - Procurar novos arquivos .txt e processar novamente');
        console.log('  2 - Encerrar a aplicação');
        rl.question('Escolha (1/2): ', (resp: string) => resolve(resp));
      });

      const choice = (answer || '2').trim();

      if (choice === '1') {
        console.log('\n🔄 Reescanear pastas YT e procurar novos arquivos .txt...');
        // Loop continua, chamando processFolderAuto novamente
      } else {
        console.log('\n👋 Encerrando aplicação conforme solicitado...');
        keepRunning = false;
      }
    }

    rl.close();
  }
}