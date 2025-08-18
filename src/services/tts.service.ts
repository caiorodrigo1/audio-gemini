import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadEnvConfig, EnvConfig } from '../config/env.config';
import { IMAGE_PROMPTS, YT_CODE_MAPPING, GENERAL_PROMPT, PromptConfig } from '../config/prompts.config';
import { Timer } from '../utils/timer.util';
import { TextChunk } from '../interfaces/text-chunk.interface';
import { WhiskApiResponse, WhiskApiPayload } from '../interfaces/whisk-response.interface';
import { WhiskAuthService } from './whisk-auth.service';
import { FishAudioService } from './fish-audio.service';
import { AUDIO_CONFIG, BATCH_SIZES, TIMEOUTS, FILE_PATTERNS } from '../constants';


@Injectable()
export class TTSService {
  private readonly config: EnvConfig;
  private whiskToken: string;
  private consoleService: any;
  private useFishAudio: boolean = false;

  constructor(
    private readonly whiskAuthService: WhiskAuthService,
    private readonly fishAudioService: FishAudioService
  ) {
    this.config = loadEnvConfig();
    this.whiskToken = this.config.whiskToken;
    
    // Garantir que sempre temos o token mais recente
    this.reloadWhiskTokenFromEnv();
  }

  setConsoleService(consoleService: any) {
    this.consoleService = consoleService;
  }

  setUseFishAudio(useFishAudio: boolean) {
    this.useFishAudio = useFishAudio;
    console.log(`🔧 Modo de áudio configurado: ${useFishAudio ? 'Fish Audio' : 'Google Gemini'}`);
    
    if (useFishAudio) {
      // Validar configuração do Fish Audio
      const validation = this.fishAudioService.validateConfiguration();
      if (!validation.isValid) {
        console.error('❌ Configuração do Fish Audio inválida:');
        validation.errors.forEach(error => console.error(`   • ${error}`));
        console.log('\n💡 Para configurar o Fish Audio:');
        console.log('   1. Crie uma conta em https://fish.audio/');
        console.log('   2. Obtenha sua API key');
        console.log('   3. Configure no arquivo .env:');
        console.log('      FISH_AUDIO_API_KEY=sua_api_key');
        console.log('      FISH_AUDIO_REFERENCE_ID=seu_reference_id');
        throw new Error('Configuração do Fish Audio inválida');
      }
    }
  }

  async updateWhiskToken(newToken: string) {
    this.whiskToken = newToken;
    
    // Salvar o novo token no arquivo .env permanentemente
    try {
      const envPath = path.join(process.cwd(), '.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Substituir o token antigo pelo novo no .env
      const updatedContent = envContent.replace(
        /WHISK_TOKEN=.*/,
        `WHISK_TOKEN=${newToken}`
      );
      
      await fs.writeFile(envPath, updatedContent, 'utf-8');
      
      // Também atualizar a variável de ambiente na sessão atual
      process.env.WHISK_TOKEN = newToken;
      
      console.log('✅ Token Whisk atualizado e salvo permanentemente no .env!');
      console.log('✅ Variável de ambiente da sessão atual também atualizada!');
      
    } catch (error) {
      console.warn('⚠️ Token atualizado na memória, mas não foi possível salvar no .env:', error.message);
      console.log('✅ Token funcionando na sessão atual!');
    }
  }

  reloadWhiskTokenFromEnv(): void {
    // Recarregar token do .env caso tenha sido atualizado externamente
    const envToken = process.env.WHISK_TOKEN;
    if (envToken && envToken !== this.whiskToken) {
      this.whiskToken = envToken;
      console.log('🔄 Token Whisk recarregado do .env');
    }
  }



  /**
   * Tenta renovar o token automaticamente
   */
  private async renewTokenAutomatically(): Promise<string> {
    console.log('🔄 Iniciando renovação automática do token...');
    
    try {
      const newToken = await this.whiskAuthService.extractWhiskToken();
      
      // Atualizar token no .env
      await this.whiskAuthService.updateTokenInEnv(newToken);
      
      // Recarregar configuração
      this.whiskToken = newToken;
      
      console.log('✅ Token renovado automaticamente!');
      return newToken;
    } catch (error) {
      console.error('❌ Falha na renovação automática:', error.message);
      throw new Error(`Não foi possível renovar o token automaticamente: ${error.message}`);
    }
  }



  cleanTitleFromFilename(filename: string): string {
    // Remove extensão se houver
    let cleanTitle = filename.replace(/\.(txt|md)$/i, '');
    
    // Agora o título vem limpo sem prefixos, apenas remover extensão é suficiente
    return cleanTitle.trim();
  }

  extractYTCodeFromPath(filePath: string): string | null {
    const match = filePath.match(FILE_PATTERNS.YT_CODE);
    return match ? match[0].toUpperCase() : null;
  }

  getPromptTypeByYTCode(ytCode: string): number {
    return YT_CODE_MAPPING[ytCode] || 0; // Default para prompt 0 (Geral)
  }

  getSpecializedPrompt(promptType: number): PromptConfig {
    return IMAGE_PROMPTS[promptType] || GENERAL_PROMPT;
  }

  getPromptStyleName(promptType: number): string {
    const promptNames = {
      0: 'Geral',
      1: 'Wild West (EN-US)', 
      2: 'Old Man Chronicles (EN-US)',
      3: 'Pessoas Desaparecidas (PT-BR)',
      4: 'Bridgerton Inglês (EN)',
      5: 'Velho Oeste Espanhol (ES)',
      6: 'Milionários Polonês (PL)',
      7: 'Famílias Italiano (IT)',
      8: 'Milionários Romeno (RO)',
      9: 'Bridgerton Brasileiro (PT-BR)',
      10: 'Jornada dos Santos - Humano até Santificação (IT)'
    };
    return promptNames[promptType] || `Tipo ${promptType}`;
  }
  
  private get apiKeys(): string[] {
    return this.config.googleApiKeys;
  }

  splitTextIntoChunks(text: string): TextChunk[] {
    console.log(`Texto recebido com ${text.length} caracteres`);
    const cleanText = text.replace(/["""]/g, '').replace(/[''']/g, '');
    console.log(`Texto limpo com ${cleanText.length} caracteres`);
    const chunks: TextChunk[] = [];
    let remainingText = cleanText;
    let chunkIndex = 0;

    while (remainingText.length > 0) {
      if (remainingText.length <= this.config.maxChunkLength) {
        const keyIndex = chunkIndex % this.apiKeys.length;
        chunks.push({
          text: remainingText,
          chunkIndex,
          apiKey: this.apiKeys[keyIndex]
        });
          break;
      }

      let cutIndex = -1;
      const lastPeriodIndex = remainingText.substring(0, this.config.maxChunkLength).lastIndexOf('.');
      
      if (lastPeriodIndex !== -1) {
        cutIndex = lastPeriodIndex + 1;
      } else {
        const lastSpaceIndex = remainingText.substring(0, this.config.maxChunkLength).lastIndexOf(' ');
        cutIndex = lastSpaceIndex !== -1 ? lastSpaceIndex : this.config.maxChunkLength;
      }

      const keyIndex = chunkIndex % this.apiKeys.length;
      chunks.push({
        text: remainingText.substring(0, cutIndex).trim(),
        chunkIndex,
        apiKey: this.apiKeys[keyIndex]
      });

      remainingText = remainingText.substring(cutIndex).trim();
      chunkIndex++;
    }

    return chunks;
  }

  async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
    // Se estiver usando Fish Audio, delegar para o FishAudioService
    if (this.useFishAudio) {
      return await this.fishAudioService.convertToSpeech(chunk);
    }
    
    // Caso contrário, usar a lógica original do Google Gemini
    const maxRetries = 5;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Rotação sequencial: chunk usa sua API key designada, tentativas usam keys seguintes
      const totalKeys = this.apiKeys.length;
      const baseKeyIndex = chunk.chunkIndex % totalKeys;  // API key base do chunk
      const apiKeyIndex = (baseKeyIndex + attempt) % totalKeys;  // Rotaciona nas tentativas
      const currentApiKey = this.apiKeys[apiKeyIndex];
      
      if (attempt === 0) {
        console.log(`📝 Chunk ${chunk.chunkIndex + 1} usando API key ${apiKeyIndex + 1}/${totalKeys} (${currentApiKey.substring(0, 15)}...)`);
      } else {
        console.log(`🔄 Tentativa ${attempt + 1} para chunk ${chunk.chunkIndex + 1} com API key ${apiKeyIndex + 1}/${totalKeys} (${currentApiKey.substring(0, 15)}...)`);
      }
      
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?key=${currentApiKey}`;
      
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: chunk.text
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["audio"],
          temperature: 1,
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: AUDIO_CONFIG.VOICE_NAME
              }
            }
          }
        }
      };

      try {
        if (attempt > 0) {
          // Delay adicional nas tentativas subsequentes
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // A resposta é um array, pegar o primeiro elemento
        const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
        
        // Verificar se a resposta tem a estrutura esperada
        if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
          throw new Error(`Resposta inválida da API - sem candidates: ${JSON.stringify(responseData)}`);
        }

        if (!responseData.candidates[0].content || !responseData.candidates[0].content.parts || !responseData.candidates[0].content.parts[0]) {
          throw new Error(`Resposta inválida da API - sem content/parts: ${JSON.stringify(responseData.candidates[0])}`);
        }

        if (!responseData.candidates[0].content.parts[0].inlineData || !responseData.candidates[0].content.parts[0].inlineData.data) {
          throw new Error(`Resposta inválida da API - sem inlineData: ${JSON.stringify(responseData.candidates[0].content.parts[0])}`);
        }

        const audioData = responseData.candidates[0].content.parts[0].inlineData.data;
        if (attempt > 0) {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso na tentativa ${attempt + 1} (API key ${apiKeyIndex + 1})!`);
        } else {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso (API key ${apiKeyIndex + 1})!`);
        }
        return Buffer.from(audioData, 'base64');
        
      } catch (error) {
        lastError = error;
        const isRateLimit = error.response?.status === 429;
        const isQuotaError = error.response?.data?.[0]?.error?.code === 429;
        
        console.error(`❌ Tentativa ${attempt + 1} falhou para chunk ${chunk.chunkIndex + 1} (API key ${apiKeyIndex + 1}):`, error.message);
        
        // Debug adicional para entender o erro
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
        }
        
        if (isRateLimit || isQuotaError) {
          console.log(`🔄 Rate limit/quota excedida (API key ${apiKeyIndex + 1}), tentando com próxima API key...`);
          if (attempt < maxRetries - 1) {
            // Aguardar mais tempo em caso de quota diária esgotada
            const isDaily = error.response?.data?.[0]?.error?.details?.some(
              detail => detail.violations?.[0]?.quotaId?.includes('PerDay')
            );
            if (isDaily) {
              console.log(`⏳ Quota diária detectada, aguardando 5s antes da próxima API key...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            continue;
          }
        } else {
          // Para outros erros, tentar uma vez mais com API key diferente
          if (attempt < maxRetries - 1) {
            console.log(`🔄 Tentando com próxima API key...`);
            continue;
          }
          break;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para chunk ${chunk.chunkIndex + 1}`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    
    // Tocar som de erro e parar a aplicação
    console.error(`🚨 ERRO CRÍTICO: Chunk ${chunk.chunkIndex + 1} falhou após ${maxRetries} tentativas!`);
    console.error('🛑 Parando a aplicação...');
    this.playErrorSound();
    
    // Aguardar um pouco para o som tocar antes de sair
    setTimeout(() => {
      process.exit(1);
    }, 2000);
    
    throw lastError;
  }

  convertToWav(rawBuffer: Buffer): Buffer {
    const { SAMPLE_RATE, NUM_CHANNELS, BITS_PER_SAMPLE } = AUDIO_CONFIG;
    const byteRate = SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8;
    const blockAlign = NUM_CHANNELS * BITS_PER_SAMPLE / 8;
    const wavHeaderSize = 44;
    const dataSize = rawBuffer.length;
    const fileSize = wavHeaderSize + dataSize - 8;
    
    const header = Buffer.alloc(wavHeaderSize);
    
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(NUM_CHANNELS, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(BITS_PER_SAMPLE, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, rawBuffer]);
  }

  async saveAudioFile(wavBuffer: Buffer, chunkIndex: number, outputDir: string): Promise<string> {
    // Se estiver usando Fish Audio, delegar para o FishAudioService (que já retorna WAV)
    if (this.useFishAudio) {
      return await this.fishAudioService.saveAudioFile(wavBuffer, chunkIndex, outputDir);
    }
    
    // Caso contrário, usar a lógica original
    const fileName = `output_audio_${chunkIndex}.wav`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, wavBuffer);
    return filePath;
  }

  playNotificationSound(): void {
    try {
      // Para Windows
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        // Som de notificação padrão do Windows
        exec('powershell -c "[System.Media.SystemSounds]::Beep.Play()"', (error) => {
          if (error) {
            console.log('🔔 Som de notificação tocado!');
          }
        });
      } else {
        // Para sistemas Unix (macOS/Linux)
        const { exec } = require('child_process');
        exec('echo -e "\\a"', () => {});
      }
    } catch (error) {
      // Falback silencioso se não conseguir tocar som
    }
  }

  playErrorSound(): void {
    try {
      // Para Windows - som de erro mais alto e repetido
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        // Toca som de erro 3 vezes
        exec('powershell -c "for($i=1; $i -le 3; $i++) { [System.Media.SystemSounds]::Hand.Play(); Start-Sleep -Milliseconds 500 }"', (error) => {
          if (error) {
            console.log('🚨 Som de erro tocado!');
          }
        });
      } else {
        // Para sistemas Unix - beep repetido
        const { exec } = require('child_process');
        exec('for i in {1..3}; do echo -e "\\a"; sleep 0.5; done', () => {});
      }
    } catch (error) {
      // Fallback: tentar som simples
      this.playNotificationSound();
    }
  }

  async processTextToSpeech(text: string, outputDir: string = this.config.defaultOutputDir, filePath?: string): Promise<string[]> {
    const totalTimer = new Timer('Processamento completo');
    totalTimer.logStart();

    if (!text) {
      throw new Error('Nenhum texto foi fornecido.');
    }

    // Criar diretório de saída se não existir
    try {
      console.log(`📁 Criando diretório: ${outputDir}`);
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`✅ Diretório criado com sucesso: ${outputDir}`);
      
      // Verificar se o diretório realmente foi criado e é acessível
      const stats = await fs.stat(outputDir);
      console.log(`📊 Diretório verificado - Permissions: ${stats.mode.toString(8)}`);
    } catch (error) {
      console.error(`❌ Erro ao criar/verificar diretório: ${error.message}`);
      throw error;
    }

    const chunks = this.splitTextIntoChunks(text);
    const savedFiles: string[] = [];

    console.log(`📊 RESUMO DE PROCESSAMENTO:`);
    console.log(`   • Total de chunks de texto: ${chunks.length}`);
    console.log(`   • Relação esperada: 1 imagem para cada chunk`);
    console.log(`   • Total de imagens que serão geradas: ${chunks.length}`);
    
    totalTimer.log(`Processando ${chunks.length} chunks de texto...`);
    console.log(`🔑 API keys carregadas: ${this.apiKeys.length}`);

    // Processamento em blocos menores para evitar quota limits
    const audioTimer = new Timer('Conversão de áudio');
    audioTimer.logStart();
    
    // Ajustar batch size baseado no modo de áudio
    const batchSize = this.useFishAudio ? BATCH_SIZES.AUDIO_PROCESSING_FISH : BATCH_SIZES.AUDIO_PROCESSING;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      totalTimer.log(`Processando bloco ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)...`);
      
      // Processar chunks do bloco em paralelo
      const batchPromises = batch.map(async (chunk) => {
        try {
          audioTimer.log(`Iniciando conversão do chunk ${chunk.chunkIndex + 1}/${chunks.length}...`);
          
          const audioData = await this.convertToSpeech(chunk);
          let finalAudio: Buffer;
          
          if (this.useFishAudio) {
            // Fish Audio já retorna WAV, não precisa converter
            finalAudio = audioData;
          } else {
            // Google Gemini retorna raw audio, precisa converter para WAV
            finalAudio = this.convertToWav(audioData);
          }
          
          const filePath = await this.saveAudioFile(finalAudio, chunk.chunkIndex, outputDir);
          
          audioTimer.log(`Chunk ${chunk.chunkIndex + 1} salvo: ${path.basename(filePath)}`);
          return filePath;
          
        } catch (error) {
          audioTimer.log(`❌ Erro ao processar chunk ${chunk.chunkIndex + 1}: ${error.message}`);
          audioTimer.log('Continuando com próximo chunk...');
          return null;
        }
      });
      
      // Aguardar todos os chunks do bloco terminarem
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Coletar chunks que falharam para retry
      const failedChunks: TextChunk[] = [];
      
      // Adicionar apenas os resultados bem-sucedidos
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          savedFiles.push(result.value);
        } else {
          // Chunk falhou, adicionar para retry
          failedChunks.push(batch[index]);
        }
      });
      
      // Retry dos chunks que falharam
      if (failedChunks.length > 0) {
        audioTimer.log(`🔄 Tentando novamente ${failedChunks.length} chunk(s) que falharam...`);
        
        for (const failedChunk of failedChunks) {
          try {
            audioTimer.log(`🔄 Retry chunk ${failedChunk.chunkIndex + 1}/${chunks.length}...`);
            
            const audioData = await this.convertToSpeech(failedChunk);
            let finalAudio: Buffer;
            
            if (this.useFishAudio) {
              // Fish Audio já retorna WAV, não precisa converter
              finalAudio = audioData;
            } else {
              // Google Gemini retorna raw audio, precisa converter para WAV
              finalAudio = this.convertToWav(audioData);
            }
            
            const filePath = await this.saveAudioFile(finalAudio, failedChunk.chunkIndex, outputDir);
            
            savedFiles.push(filePath);
            audioTimer.log(`✅ Chunk ${failedChunk.chunkIndex + 1} salvo no retry: ${path.basename(filePath)}`);
            
          } catch (retryError) {
            audioTimer.log(`❌ Retry falhou para chunk ${failedChunk.chunkIndex + 1}: ${retryError.message}`);
            audioTimer.log(`⏭️ Pulando chunk ${failedChunk.chunkIndex + 1} definitivamente`);
          }
          
          // Delay entre retries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Verificar se muitos chunks falharam consecutivamente (indicativo de problema geral)
      const currentBatchFailed = batchResults.every(result => result.status === 'rejected');
      if (currentBatchFailed && batch.length > 1) {
        console.log(`🚨 ALERTA: Todos os chunks do bloco ${Math.floor(i / batchSize) + 1} falharam!`);
        console.log(`🔍 Possível problema: API keys esgotadas ou erro de conectividade`);
        
        // Se for o primeiro bloco e todos falharam, parar execução
        if (i === 0) {
          console.log(`❌ EXECUÇÃO INTERROMPIDA: Todos os chunks do primeiro bloco falharam`);
          console.log(`💡 Verifique as API keys ou tente novamente mais tarde`);
          this.playErrorSound();
          audioTimer.logEnd();
          totalTimer.logEnd();
          throw new Error('Execução interrompida: falha crítica na geração de áudio');
        }
      }
      
      // Delay entre blocos baseado no modo de áudio
      if (i + batchSize < chunks.length) {
        if (this.useFishAudio) {
          audioTimer.log('Aguardando 3s antes do próximo bloco (Fish Audio)...');
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos para Fish Audio
        } else {
          audioTimer.log('Aguardando 30s antes do próximo bloco (Google free tier limits)...');
          await new Promise(resolve => setTimeout(resolve, 30000)); // 30 segundos para Google
        }
      }
    }
    
    audioTimer.logEnd();
    
    // Estatísticas finais
    const totalChunks = chunks.length;
    const successfulChunks = savedFiles.length;
    const failedChunks = totalChunks - successfulChunks;
    
    totalTimer.log(`📊 Estatísticas de áudio: ${successfulChunks}/${totalChunks} chunks convertidos`);
    if (failedChunks > 0) {
      totalTimer.log(`⚠️ ${failedChunks} chunk(s) falharam definitivamente`);
    }

    // Gerar prompts de imagem após conversão de áudio
    try {
      // Detectar código YT e determinar tipo de prompt primeiro
      let promptType = 0; // Default para prompt geral
      let cleanTitle = '';
      
      if (filePath) {
        const ytCode = this.extractYTCodeFromPath(filePath);
        const fileName = path.basename(filePath, path.extname(filePath));
        cleanTitle = this.cleanTitleFromFilename(fileName);
        
        if (ytCode) {
          promptType = this.getPromptTypeByYTCode(ytCode);
          const promptNames = {
            0: 'Geral',
            1: 'Wild West (EN-US)', 
            2: 'Old Man Chronicles (EN-US)',
            3: 'Pessoas Desaparecidas (PT-BR)',
            4: 'Bridgerton Inglês (EN)',
            5: 'Velho Oeste Espanhol (ES)',
            6: 'Milionários Polonês (PL)',
            7: 'Famílias Italiano (IT)',
            8: 'Milionários Romeno (RO)',
            9: 'Bridgerton Brasileiro (PT-BR)',
            10: 'Jornada dos Santos - Humano até Santificação (IT)'
          };
          totalTimer.log(`📁 Código detectado: ${ytCode} → ${promptNames[promptType] || `Prompt tipo ${promptType}`}`);
        } else {
          totalTimer.log(`📁 Código YT não identificado → Usando prompt geral baseado no conteúdo`);
          promptType = 0; // Usar prompt geral
        }
      }
      
      totalTimer.log('🎨 Gerando prompts de imagem...');
      const promptTimer = new Timer('Geração de prompts');
      promptTimer.logStart();
      promptTimer.log('📝 Analisando personagens para consistência visual...');
      const prompts = await this.generateImagePrompts(chunks, outputDir, promptType);
      promptTimer.logEnd();
      
      // Gerar thumbnail separada baseada no título limpo
      if (cleanTitle) {
        totalTimer.log('🎯 Gerando thumbnail baseada no título...');
        const thumbnailTimer = new Timer('Geração de thumbnail');
        thumbnailTimer.logStart();
        await this.generateThumbnail(cleanTitle, outputDir, promptType);
        thumbnailTimer.logEnd();
      }
      
      // Gerar imagens com Whisk após prompts
      totalTimer.log('🖼️ Gerando imagens com Whisk...');
      const imageTimer = new Timer('Geração de imagens');
      imageTimer.logStart();
      await this.generateImagesWithWhisk(prompts, outputDir);
      imageTimer.logEnd();

      // Renderizar vídeo final com FFmpeg
      totalTimer.log('🎬 Renderizando vídeo final...');
      const videoTimer = new Timer('Renderização de vídeo');
      videoTimer.logStart();
      await this.renderVideoWithFFmpeg(outputDir, filePath);
      videoTimer.logEnd();
      
    } catch (error) {
      totalTimer.log(`❌ Erro ao gerar prompts/imagens/vídeo: ${error.message}`);
      totalTimer.log('Áudios foram gerados com sucesso, mas prompts/imagens/vídeo falharam.');
      totalTimer.log(`💡 Para tentar renderizar o vídeo novamente, use o comando:`);
      totalTimer.log(`   RENDER "${outputDir}"`);
    }

    totalTimer.logEnd();
    console.log(`\n🎯 TEMPO TOTAL DE EXECUÇÃO: ${totalTimer.getElapsedTime()}`);
    
    // Tocar som de notificação quando terminar
    this.playNotificationSound();
    console.log('🔔 Processo concluído! Som de notificação emitido.');

    return savedFiles;
  }

  async analyzeCharacters(fullText: string, promptType: number): Promise<string> {
    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    const analysisPrompt = `Analise o seguinte texto e identifique os personagens principais e suas características físicas específicas.
    
TEXTO PARA ANÁLISE:
${fullText}

INSTRUÇÕES:
- Identifique os personagens principais da história
- Para cada personagem, extraia características físicas específicas mencionadas no texto
- Se não houver descrições físicas específicas, crie características consistentes baseadas no contexto e tipo de história
- Foque em: idade, cabelo (cor, estilo), olhos (cor, formato), rosto (formato, traços), altura, constituição física
- Use o contexto cultural/temporal da história para criar características apropriadas

FORMATO DE RESPOSTA:
PERSONAGEM 1: [Nome ou descrição]
- Idade: [idade específica]
- Cabelo: [cor, estilo, textura]
- Olhos: [cor, formato]
- Rosto: [formato, traços específicos]
- Físico: [altura, constituição]
- Outros detalhes: [cicatrizes, barba, etc.]

PERSONAGEM 2: [Nome ou descrição]
- [mesma estrutura]

Seja específico e detalhado para garantir consistência visual.`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${specializedPrompt.systemPrompt} Você é especialista em identificar e descrever personagens para manter consistência visual em imagens.`
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Erro ao analisar personagens:', error.message);
      return 'ERRO: Não foi possível analisar personagens. Use descrições genéricas consistentes.';
    }
  }

  async generateImagePrompts(chunks: TextChunk[], outputDir: string, promptType: number): Promise<string[]> {
    const batchSize = BATCH_SIZES.PROMPT_GENERATION;
    const allPrompts: string[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} para prompts de imagem...`);

      try {
        const prompts = await this.callChatGPT(batch, promptType, outputDir);
        allPrompts.push(...prompts);
        console.log(`✅ Gerados ${prompts.length} prompts para o lote`);
      } catch (error) {
        console.error(`❌ Erro ao processar lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        // Adicionar prompts vazios para manter numeração
        for (let j = 0; j < batch.length; j++) {
          allPrompts.push(`[ERRO] Não foi possível gerar prompt para o chunk ${batch[j].chunkIndex + 1}`);
        }
      }

      // Delay entre lotes
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Salvar prompts em arquivo
    await this.saveImagePrompts(allPrompts, outputDir);
    
    console.log(`📝 PROMPTS GERADOS: ${allPrompts.length} prompts para ${chunks.length} chunks`);
    if (allPrompts.length !== chunks.length) {
      console.warn(`⚠️ AVISO: Número de prompts (${allPrompts.length}) diferente do número de chunks (${chunks.length})`);
    }
    
    return allPrompts;
  }

  async callChatGPT(chunks: TextChunk[], promptType: number = 0, outputDir?: string): Promise<string[]> {
    const chunksText = chunks.map((chunk, index) => 
      `=== CHUNK ${chunk.chunkIndex + 1} ===\n${chunk.text}\n`
    ).join('\n');

    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    // Log do prompt sendo usado
    const promptNames = {
      0: 'Geral',
      1: 'Wild West (EN-US)', 
      2: 'Old Man Chronicles (EN-US)',
      3: 'Pessoas Desaparecidas (PT-BR)',
      4: 'Bridgerton Inglês (EN)',
      5: 'Velho Oeste Espanhol (ES)',
      6: 'Milionários Polonês (PL)',
      7: 'Famílias Italiano (IT)',
      8: 'Milionários Romeno (RO)',
      9: 'Bridgerton Brasileiro (PT-BR)',
      10: 'Jornada dos Santos - Humano até Santificação (IT)'
    };
    
    console.log(`🎨 Usando prompt especializado: ${promptNames[promptType] || `Tipo ${promptType}`}`);
    
    // Primeiro, analisar o texto para identificar personagens
    const characterAnalysis = await this.analyzeCharacters(chunksText, promptType);
    
    // Salvar análise de personagens se outputDir for fornecido
    if (outputDir) {
      await this.saveCharacterAnalysis(characterAnalysis, outputDir);
    }
    
    const prompt = `${specializedPrompt.userPrompt}

ANÁLISE DE PERSONAGENS (MANTENHA CONSISTÊNCIA VISUAL):
${characterAnalysis}

INSTRUÇÕES DE CONSISTÊNCIA VISUAL:
- SEMPRE use as características faciais específicas dos personagens identificados acima
- MANTENHA os mesmos traços físicos (formato do rosto, nariz, olhos, boca, cabelo, idade) em TODAS as imagens
- Para personagens principais, SEMPRE inclua: cor dos olhos, formato do nariz, tipo de cabelo, idade aparente, estrutura facial
- Se um personagem aparece em múltiplas cenas, use EXATAMENTE as mesmas características físicas
- Para personagens secundários, mantenha consistência se aparecerem novamente

INSTRUÇÕES DE FOTORREALISMO OBRIGATÓRIAS:
- SEMPRE comece cada prompt com "Photorealistic"
- SEMPRE inclua "cinematic quality", "professional photography", "high detail"
- SEMPRE especifique "realistic skin textures", "natural lighting", "authentic facial expressions"
- NUNCA use palavras como "cartoon", "animated", "illustration", "drawing", "art", "painting"
- SEMPRE prefira "photograph" ao invés de "image"
- Inclua detalhes técnicos: "shot with professional camera", "85mm lens", "shallow depth of field"

${chunksText}

IMPORTANTE: Retorne EXATAMENTE ${chunks.length} prompts numerados, um para cada chunk.
O PRIMEIRO prompt deve ser uma THUMBNAIL de alto CTR conforme especificado no estilo.
Use as características dos personagens identificadas acima para manter consistência visual.
Mantenha cada prompt em uma única linha.

Formato obrigatório (EXATAMENTE ${chunks.length} prompts):
1. [THUMBNAIL - prompt especializado para chunk 1 COM características específicas dos personagens]
2. [prompt especializado para chunk 2 COM características específicas dos personagens]  
3. [prompt especializado para chunk 3 COM características específicas dos personagens]
...
${chunks.length}. [prompt especializado para chunk ${chunks.length} COM características específicas dos personagens]

NÃO adicione prompts extras. PARE no número ${chunks.length}.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${specializedPrompt.systemPrompt}

REGRA CRÍTICA: Você deve retornar EXATAMENTE ${chunks.length} prompts numerados. Nem mais, nem menos. Conte cuidadosamente antes de responder.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // Extrair prompts numerados
    const lines = content.split('\n').filter((line: string) => line.trim());
    const prompts = lines
      .filter((line: string) => /^\d+\.\s/.test(line.trim()))
      .map((line: string) => line.replace(/^\d+\.\s/, '').trim());

    // Garantir que temos exatamente o número correto de prompts
    const expectedCount = chunks.length;
    if (prompts.length !== expectedCount) {
      console.warn(`⚠️ ChatGPT retornou ${prompts.length} prompts, mas esperávamos ${expectedCount}`);
      
      if (prompts.length > expectedCount) {
        // Se temos prompts demais, pegar apenas os primeiros
        console.log(`✂️ Limitando para os primeiros ${expectedCount} prompts`);
        return prompts.slice(0, expectedCount);
      } else {
        // Se temos prompts de menos, duplicar o último
        console.log(`📋 Duplicando prompts para atingir ${expectedCount}`);
        while (prompts.length < expectedCount) {
          const lastPrompt = prompts[prompts.length - 1] || 'Photorealistic professional photograph, cinematic quality';
          prompts.push(lastPrompt);
        }
      }
    }

    return prompts;
  }

  async saveImagePrompts(prompts: string[], outputDir: string): Promise<void> {
    const fileName = 'prompts_de_imagem.txt';
    const filePath = path.join(outputDir, fileName);
    
    const content = prompts.map((prompt, index) => 
      `=== PROMPT ${index + 1} ===\n${prompt}\n=== IMAGEM CORRESPONDENTE: imagem_${index + 1}.jpg ===\n`
    ).join('\n');

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`📝 Prompts de imagem salvos em: ${filePath}`);
  }

  async saveCharacterAnalysis(characterAnalysis: string, outputDir: string): Promise<void> {
    const fileName = 'analise_personagens.txt';
    const filePath = path.join(outputDir, fileName);
    
    const content = `=== ANÁLISE DE PERSONAGENS PARA CONSISTÊNCIA VISUAL ===

${characterAnalysis}

=== INSTRUÇÕES ===
Este arquivo contém a análise dos personagens principais da história.
Use estas características para manter consistência visual em todas as imagens.
Cada personagem deve ter EXATAMENTE as mesmas características físicas em todas as cenas.

Data de criação: ${new Date().toLocaleString('pt-BR')}
`;

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`👥 Análise de personagens salva em: ${filePath}`);
  }

  async generateImagesWithWhisk(prompts: string[], outputDir: string): Promise<void> {
    const imageGenTimer = new Timer('Geração individual de imagens');
    
    if (prompts.length === 0) {
      imageGenTimer.log('❌ Nenhum prompt disponível para gerar imagens');
      return;
    }

    imageGenTimer.log(`🖼️ Gerando ${prompts.length} imagem(ns) com Whisk...`);
    console.log(`🎯 CONFIRMAÇÃO: Iniciando geração de ${prompts.length} imagens (1 para cada chunk de áudio)`);

    let successfulImages = 0;
    let skippedImages = 0;

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      if (prompt.startsWith('[ERRO]')) {
        imageGenTimer.log(`⏭️ Pulando prompt ${i + 1} (erro)`);
        skippedImages++;
        continue;
      }

      // Tentar gerar imagem com correção automática de prompts inválidos
      const success = await this.tryGenerateImageWithCorrection(prompt, i, outputDir, imageGenTimer);
      
      if (success) {
        successfulImages++;
        imageGenTimer.log(`✅ Imagem ${i + 1} salva com sucesso`);
      } else {
        skippedImages++;
        imageGenTimer.log(`❌ Pulando imagem ${i + 1} após 3 tentativas de correção`);
      }

      // Delay entre imagens para evitar rate limiting
      if (i < prompts.length - 1) {
        imageGenTimer.log(`⏳ Aguardando 3s antes da próxima imagem...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`📊 RESUMO FINAL DA GERAÇÃO DE IMAGENS:`);
    console.log(`   • Imagens geradas com sucesso: ${successfulImages}`);
    console.log(`   • Imagens puladas/erro: ${skippedImages}`);
    console.log(`   • Total processado: ${successfulImages + skippedImages}/${prompts.length}`);
    console.log(`   • Status: ${successfulImages === prompts.length ? '✅ Todas as imagens geradas' : '⚠️ Algumas imagens falharam'}`);
  }

  async tryGenerateImageWithCorrection(originalPrompt: string, imageIndex: number, outputDir: string, timer?: Timer): Promise<boolean> {
    let currentPrompt = originalPrompt;
    const maxCorrections = 3;

    for (let correctionAttempt = 0; correctionAttempt < maxCorrections; correctionAttempt++) {
      try {
        if (timer) {
          timer.log(`🎨 Gerando imagem ${imageIndex + 1} (tentativa ${correctionAttempt + 1}/3)...`);
        }
        const imageBuffer = await this.callWhiskAPI(currentPrompt);
        await this.saveImage(imageBuffer, imageIndex, outputDir);
        return true; // Sucesso!
        
      } catch (error) {
        const isInvalidArgument = error.response?.status === 400 && 
                                 error.response?.data?.error?.code === 400 &&
                                 error.response?.data?.error?.status === 'INVALID_ARGUMENT';
        
        if (isInvalidArgument && correctionAttempt < maxCorrections - 1) {
          if (timer) {
            timer.log(`❌ Prompt inválido detectado. Pedindo correção ao ChatGPT...`);
          }
          
          try {
            const correctedPrompt = await this.fixInvalidPrompt(currentPrompt, error.response.data.error.message);
            currentPrompt = correctedPrompt;
            if (timer) {
              timer.log(`🔄 Prompt corrigido. Tentando novamente...`);
            }
            
          } catch (fixError) {
            if (timer) {
              timer.log(`❌ Erro ao corrigir prompt: ${fixError.message}`);
            }
            return false;
          }
          
        } else {
          if (timer) {
            timer.log(`❌ Erro ao gerar imagem após ${correctionAttempt + 1} tentativas: ${error.message}`);
          }
          if (correctionAttempt === maxCorrections - 1) {
            return false; // Falhou todas as tentativas
          }
        }
      }
    }
    
    return false;
  }

  async fixInvalidPrompt(invalidPrompt: string, errorMessage: string): Promise<string> {
    const correctionPrompt = `O seguinte prompt para geração de imagem foi rejeitado pelo Whisk API com erro 400:

PROMPT INVÁLIDO:
"${invalidPrompt}"

ERRO RETORNADO:
"${errorMessage}"

Por favor, corrija este prompt removendo elementos que podem causar violação das políticas do Whisk:
- Remova referências a pessoas reais específicas
- Remova conteúdo violento, sexual ou inapropriado  
- Simplifique descrições muito complexas
- Mantenha o estilo e essência da cena
- Retorne apenas o prompt corrigido, sem explicações

PROMPT CORRIGIDO:`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em corrigir prompts de imagem para APIs que rejeitam conteúdo inadequado. Seja conciso e mantenha a essência da cena.'
        },
        {
          role: 'user',
          content: correctionPrompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  }

  async callWhiskAPI(prompt: string): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;
    let tokenRenewed = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries} para gerar imagem...`);
          // Delay progressivo entre tentativas
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const payload: WhiskApiPayload = {
          clientContext: {
            workflowId: this.generateUUID(),
            tool: "BACKBONE",
            sessionId: `;${Date.now()}`
          },
          imageModelSettings: {
            imageModel: "IMAGEN_3_5",
            aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE"
          },
          seed: Math.floor(Math.random() * 1000000),
          prompt: prompt,
          mediaCategory: "MEDIA_CATEGORY_BOARD"
        };

        const response = await axios.post('https://aisandbox-pa.googleapis.com/v1/whisk:generateImage', payload, {
          headers: {
            'accept': '*/*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,it;q=0.6',
            'authorization': `Bearer ${this.whiskToken}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://labs.google',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://labs.google/',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-browser-channel': 'stable',
            'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
            'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
            'x-browser-year': '2025',
            'x-client-data': 'CKW1yQEIjbbJAQiktskBCKmdygEI34DLAQiTocsBCKSjywEIhaDNAQjh8M4BCKXyzgE='
          }
        });

        // Extrair a imagem base64 da resposta
        const responseData: WhiskApiResponse = response.data;
        
        if (!responseData || !responseData.imagePanels || !responseData.imagePanels[0] || 
            !responseData.imagePanels[0].generatedImages || !responseData.imagePanels[0].generatedImages[0] ||
            !responseData.imagePanels[0].generatedImages[0].encodedImage) {
          throw new Error(`Resposta inválida do Whisk: ${JSON.stringify(responseData)}`);
        }

        // Decodificar base64 para buffer
        const base64Image = responseData.imagePanels[0].generatedImages[0].encodedImage;
        
        if (attempt > 0) {
          console.log(`✅ Imagem gerada com sucesso na tentativa ${attempt + 1}!`);
        }
        
        return Buffer.from(base64Image, 'base64');

      } catch (error) {
        lastError = error;
        const isUnauthorized = error.response?.status === 401 || error.response?.status === 403;
        const isRateLimit = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        
        console.error(`❌ Tentativa ${attempt + 1}/${maxRetries} falhou:`, error.message);
        
        if (isUnauthorized && !tokenRenewed) {
          console.log(`🔑 Erro de autenticação detectado (${error.response?.status}) - Token Whisk expirado!`);
          console.log(`🤖 Tentando renovar token automaticamente...`);
          
          try {
            await this.renewTokenAutomatically();
            tokenRenewed = true;
            console.log(`✅ Token renovado! Tentando novamente...`);
            continue; // Tentar novamente com novo token
          } catch (renewError) {
            console.error(`❌ Falha na renovação automática:`, renewError.message);
            console.log(`🔔 Tentando método manual como fallback...`);
            
            // Fallback para método manual
            this.playErrorSound();
            if (this.consoleService && typeof this.consoleService.promptForNewToken === 'function') {
              try {
                console.log(`🔔 Aguardando novo token manual...`);
                const newToken = await this.consoleService.promptForNewToken();
                if (newToken && newToken.length > 10) {
                  await this.updateWhiskToken(newToken);
                  tokenRenewed = true;
                  console.log(`🔄 Tentando novamente com o novo token manual...`);
                  continue;
                } else {
                  console.log(`❌ Token inválido fornecido`);
                  this.playErrorSound();
                  break;
                }
              } catch (tokenError) {
                console.error(`❌ Erro ao obter novo token manual:`, tokenError.message);
                this.playErrorSound();
                break;
              }
            } else {
              console.log(`❌ Ambos os métodos falharam - consulte a documentação`);
              console.log(`💡 Execute: npm run extract-token`);
              this.playErrorSound();
              break;
            }
          }
        } else if (isUnauthorized && tokenRenewed) {
          console.log(`❌ Token ainda inválido após renovação - verifique configuração`);
          this.playErrorSound();
          break;
        } else if (isRateLimit || isServerError) {
          console.log(`🔄 Erro de rate limit/servidor, tentando novamente...`);
          if (attempt < maxRetries - 1) {
            continue; // Tentar novamente
          }
        } else {
          // Erro que não é recuperável - não tentar novamente
          break;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para gerar imagem`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    throw lastError;
  }

  async saveImage(imageBuffer: Buffer, imageIndex: number, outputDir: string): Promise<void> {
    const fileName = `imagem_${imageIndex + 1}.jpg`;
    const filePath = path.join(outputDir, fileName);
    
    // Salvar imagem original primeiro
    await fs.writeFile(filePath, imageBuffer);
    console.log(`🖼️ Imagem ${imageIndex + 1} salva: ${fileName}`);
    
    // Fazer upscaling/crop para 1920x1080
    await this.upscaleImageTo1920x1080(filePath, outputDir, imageIndex);
  }

  async saveThumbnail(imageBuffer: Buffer, cleanTitle: string, outputDir: string): Promise<void> {
    const fileName = `${cleanTitle}.jpg`;
    const filePath = path.join(outputDir, fileName);
    
    // Salvar thumbnail original primeiro
    await fs.writeFile(filePath, imageBuffer);
    console.log(`🎯 Thumbnail salva: ${fileName}`);
    
    // Fazer upscaling/crop para 1920x1080
    await this.upscaleThumbnailTo1920x1080(filePath, cleanTitle, outputDir);
  }

  async generateThumbnail(cleanTitle: string, outputDir: string, promptType: number): Promise<void> {
    try {
      console.log(`🎯 Criando thumbnail para: "${cleanTitle}"`);
      
      // Gerar prompt de thumbnail baseado no título e tipo de prompt
      const thumbnailPrompt = await this.generateThumbnailPrompt(cleanTitle, promptType);
      
      // Gerar imagem com Whisk
      const imageBuffer = await this.callWhiskAPI(thumbnailPrompt);
      
      // Salvar thumbnail com nome do título
      await this.saveThumbnail(imageBuffer, cleanTitle, outputDir);
      
      console.log(`✅ Thumbnail gerada com sucesso: ${cleanTitle}.jpg`);
      
    } catch (error) {
      console.error(`❌ Erro ao gerar thumbnail para "${cleanTitle}":`, error.message);
    }
  }

  async generateThumbnailPrompt(cleanTitle: string, promptType: number): Promise<string> {
    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    const prompt = `TÍTULO DA HISTÓRIA: "${cleanTitle}"
ESTILO: ${this.getPromptStyleName(promptType)}

Crie um prompt FOTORREALISTA de thumbnail baseado DIRETAMENTE na cena específica do título fornecido.

OBRIGATÓRIO - FOTORREALISMO EXTREMO:
- SEMPRE comece com "Photorealistic professional photograph"
- SEMPRE inclua "shot with Canon EOS R5, 85mm f/1.4 lens, professional studio lighting"
- SEMPRE especifique "ultra-realistic skin textures, pore-level detail, natural subsurface scattering"
- SEMPRE inclua "cinematic color grading, shot on Arri Alexa, film grain texture"
- NUNCA use "illustration", "art", "drawing", "cartoon", "animated", "digital art"
- SEMPRE use "photograph of real person" ao invés de "image"

FOCO NA CENA ESPECÍFICA DO TÍTULO:
1. Analise o TÍTULO LITERALMENTE - identifique a situação, personagem ou evento específico
2. Crie uma cena que REPRESENTA EXATAMENTE o que o título descreve
3. FOQUE no MOMENTO CENTRAL da história mencionada no título
4. Use DETALHES ESPECÍFICOS do contexto cultural/temporal do tipo de história
5. PERSONALIZE baseado no que o título sugere (não use cenas genéricas)

COMPOSIÇÃO PARA ALTA CTR:
- Personagem PRINCIPAL em primeiro plano ocupando 60-70% do quadro
- Expressão facial ESPECÍFICA para a situação do título (não genérica)
- Cenário que CONTA A HISTÓRIA do título visualmente
- Elementos visuais que remetam diretamente ao título
- Iluminação dramática que destaque a emoção da cena específica

DETALHES TÉCNICOS OBRIGATÓRIOS:
- "professional photography equipment, Phase One XF IQ4, Schneider Kreuznach lens"
- "realistic facial expressions with micro-expressions, authentic human emotions"
- "natural lighting setup with key light, fill light, rim light"
- "sharp focus on eyes, shallow depth of field background blur"
- "color temperature 5600K, professional color correction"

Retorne APENAS o prompt da thumbnail focado na cena específica do título, uma linha completa e detalhada.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em criar thumbnails de alta performance para YouTube. Sua especialidade é transformar títulos em prompts que geram imagens chamativas que maximizam CTR. Foque sempre em: rosto expressivo em primeiro plano, emoção intensa, contraste visual, elementos de curiosidade e mistério.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.8
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  }

  async upscaleImageTo1920x1080(originalPath: string, outputDir: string, imageIndex: number): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    const upscaleTimer = new Timer(`Upscaling imagem ${imageIndex + 1}`);
    
    try {
      upscaleTimer.log(`🔍 Fazendo upscaling da imagem ${imageIndex + 1} para 1920x1080...`);
      
      // Criar arquivo de saída 1920x1080
      const upscaledFileName = `imagem_${imageIndex + 1}_1920x1080.jpg`;
      const upscaledPath = path.join(outputDir, upscaledFileName);
      
      // Comando FFmpeg: Scale com zoom ligeiro para preencher 1920x1080 sem padding
      // Usa 'increase' com crop mínimo para eliminar bordas pretas
      const ffmpegCommand = `ffmpeg -y -v error -i "${originalPath}" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -q:v 2 "${upscaledPath}"`;
      
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });
      
      upscaleTimer.log(`✅ Imagem ${imageIndex + 1} upscaled para 1920x1080: ${upscaledFileName}`);
      
      // Substituir a imagem original pela upscaled
      await fs.unlink(originalPath);
      await fs.rename(upscaledPath, originalPath);
      
      upscaleTimer.log(`🔄 Imagem ${imageIndex + 1} substituída pela versão 1920x1080`);
      
    } catch (error) {
      upscaleTimer.log(`❌ Erro ao fazer upscaling da imagem ${imageIndex + 1}: ${error.message}`);
      upscaleTimer.log(`⚠️ Mantendo imagem original`);
    }
  }

  async upscaleThumbnailTo1920x1080(originalPath: string, cleanTitle: string, outputDir: string): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      console.log(`🔍 Fazendo upscaling da thumbnail "${cleanTitle}" para 1920x1080...`);
      
      // Criar arquivo de saída 1920x1080
      const upscaledFileName = `${cleanTitle}_1920x1080.jpg`;
      const upscaledPath = path.join(outputDir, upscaledFileName);
      
      // Comando FFmpeg: Scale com zoom ligeiro para preencher 1920x1080 sem padding
      const ffmpegCommand = `ffmpeg -y -v error -i "${originalPath}" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -q:v 2 "${upscaledPath}"`;
      
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });
      
      console.log(`✅ Thumbnail "${cleanTitle}" upscaled para 1920x1080: ${upscaledFileName}`);
      
      // Substituir a thumbnail original pela upscaled
      await fs.unlink(originalPath);
      await fs.rename(upscaledPath, originalPath);
      
      console.log(`🔄 Thumbnail "${cleanTitle}" substituída pela versão 1920x1080`);
      
    } catch (error) {
      console.error(`❌ Erro ao fazer upscaling da thumbnail "${cleanTitle}":`, error.message);
      console.log(`⚠️ Mantendo thumbnail original`);
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async executeFFmpegWithRetry(command: string, description: string, maxRetries: number = 3): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Retry ${attempt + 1}/${maxRetries} para ${description}...`);
          // Backoff exponencial: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        await execAsync(command, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 });
        
        if (attempt > 0) {
          console.log(`✅ ${description} sucesso no retry ${attempt + 1}!`);
        }
        return; // Sucesso
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Tentativa ${attempt + 1}/${maxRetries} falhou para ${description}: ${error.message}`);
        
        // Se for o último retry, não continuar
        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para ${description}`);
    throw lastError;
  }

  async renderVideoWithFFmpeg(outputDir: string, filePath?: string): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      // Verificar se FFmpeg está instalado
      try {
        await execAsync('ffmpeg -version', { maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
      } catch (error) {
        throw new Error(`FFmpeg não encontrado. Por favor, instale o FFmpeg:
        
📥 INSTALAÇÃO DO FFMPEG:
Windows: 
1. Baixe de: https://ffmpeg.org/download.html#build-windows
2. Extraia e adicione ao PATH do sistema
3. Ou use: winget install FFmpeg

Linux/Mac:
- Ubuntu/Debian: sudo apt install ffmpeg
- CentOS/RHEL: sudo yum install ffmpeg
- macOS: brew install ffmpeg

❗ Após a instalação, reinicie o terminal e tente novamente.`);
      }

      console.log('🎬 Iniciando renderização do vídeo com FFmpeg...');

      // Verificar se os arquivos de áudio e imagem existem
      const audioFiles = await this.getAudioFiles(outputDir);
      const imageFiles = await this.getImageFiles(outputDir);

      if (audioFiles.length === 0) {
        throw new Error('Nenhum arquivo de áudio encontrado para renderização');
      }

      if (imageFiles.length === 0) {
        throw new Error('Nenhuma imagem encontrada para renderização');
      }

      console.log(`📊 Encontrados ${audioFiles.length} áudios e ${imageFiles.length} imagens`);

      // Verificar se temos imagens suficientes (1 imagem por áudio)
      const requiredImages = audioFiles.length;
      if (imageFiles.length < requiredImages) {
        console.warn(`⚠️ Aviso: Temos ${imageFiles.length} imagens, mas precisamos de ${requiredImages} (1 por áudio)`);
        console.log(`Algumas imagens serão reutilizadas...`);
      }

      // Criar lista de inputs para FFmpeg - 1 imagem por áudio
      const videoSegments: string[] = [];

      for (let i = 0; i < audioFiles.length; i++) {
        const audioFile = audioFiles[i];
        
        // Verificar se arquivo de áudio existe
        try {
          await fs.access(audioFile);
        } catch (error) {
          console.error(`❌ Arquivo de áudio não encontrado: ${audioFile}`);
          continue;
        }
        
        // Usar 1 imagem para este áudio
        const imageIndex = i % imageFiles.length;
        const image = imageFiles[imageIndex];
        
        // Verificar se arquivo de imagem existe
        try {
          await fs.access(image);
        } catch (error) {
          console.error(`❌ Arquivo de imagem não encontrado: ${error.message}`);
          continue;
        }
        
        console.log(`🎥 Criando segmento ${i + 1}/${audioFiles.length} (1 imagem por áudio)...`);
        console.log(`   📸 Imagem: ${path.basename(image)}`);
        console.log(`   🎵 Áudio: ${path.basename(audioFile)}`);

        // Criar segmento com a imagem completa durante todo o áudio
        const segmentOutput = path.join(outputDir, `segment_${i + 1}.mp4`);
        
        // Obter duração do áudio
        console.log(`📊 Obtendo duração do áudio: ${path.basename(audioFile)}`);
        let totalDuration = 10; // Padrão
        
        try {
          const durationCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`;
          console.log(`🔍 Executando comando: ${durationCommand}`);
          const durationResult = await execAsync(durationCommand, { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }); // 30s timeout
          totalDuration = parseFloat(durationResult.stdout.trim());
          console.log(`⏱️ Duração total: ${totalDuration}s`);
        } catch (durationError) {
          console.error(`❌ Erro ao obter duração do áudio:`, durationError.message);
          console.log(`⚠️ Usando duração padrão: ${totalDuration}s`);
        }
        
        // Criar segmento: imagem + áudio completo
        console.log(`🎬 Criando segmento completo...`);
        const ffmpegCommand = `ffmpeg -y -v error -loop 1 -i "${image}" -i "${audioFile}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${segmentOutput}"`;
        
        try {
          await this.executeFFmpegWithRetry(ffmpegCommand, `segmento ${i + 1}`);
          console.log(`✅ Segmento criado: ${path.basename(segmentOutput)}`);
        } catch (ffmpegError) {
          console.error(`❌ Erro no segmento:`, ffmpegError.message);
          throw ffmpegError;
        }
        
        videoSegments.push(segmentOutput);
        console.log(`✅ Segmento ${i + 1} criado (${totalDuration.toFixed(1)}s): ${path.basename(segmentOutput)}`);
      }

      // Criar arquivo de lista para concatenação
      const listFile = path.join(outputDir, 'segments_list.txt');
      const listContent = videoSegments.map(segment => `file '${segment}'`).join('\n');
      await fs.writeFile(listFile, listContent, 'utf-8');

      // Concatenar todos os segmentos
      let videoFileName = 'video_final.mp4';
      if (filePath) {
        const fileName = path.basename(filePath, path.extname(filePath));
        const cleanTitle = this.cleanTitleFromFilename(fileName);
        if (cleanTitle) {
          videoFileName = `${cleanTitle}.mp4`;
        }
      }
      
      const finalOutput = path.join(outputDir, videoFileName);
      const concatCommand = `ffmpeg -y -v error -f concat -safe 0 -i "${listFile}" -c copy "${finalOutput}"`;
      
      console.log('🔗 Concatenando segmentos...');
      await execAsync(concatCommand, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

      // Limpar arquivos temporários
      console.log('🧹 Limpando arquivos temporários...');
      for (const segment of videoSegments) {
        try {
          await fs.unlink(segment);
        } catch (error) {
          console.warn(`Aviso: Não foi possível deletar ${segment}`);
        }
      }
      
      try {
        await fs.unlink(listFile);
      } catch (error) {
        console.warn('Aviso: Não foi possível deletar o arquivo de lista');
      }

      console.log(`🎉 Vídeo renderizado com sucesso: ${finalOutput}`);
      return finalOutput;

    } catch (error) {
      console.error('❌ Erro durante a renderização:', error.message);
      throw error;
    }
  }

  private async getAudioFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const audioFiles = files
        .filter(file => file.startsWith('output_audio_') && file.endsWith('.wav'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(FILE_PATTERNS.AUDIO_FILE)?.[1] || '0');
          const bNum = parseInt(b.match(FILE_PATTERNS.AUDIO_FILE)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return audioFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de áudio:', error);
      return [];
    }
  }

  private async getImageFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const imageFiles = files
        .filter(file => file.startsWith('imagem_') && file.endsWith('.jpg'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(FILE_PATTERNS.IMAGE_FILE)?.[1] || '0');
          const bNum = parseInt(b.match(FILE_PATTERNS.IMAGE_FILE)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return imageFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de imagem:', error);
      return [];
    }
  }

  async renderExistingFiles(outputDir: string): Promise<string> {
    console.log(`\n🎬 Renderizando vídeo a partir dos arquivos existentes em: ${outputDir}`);
    return await this.renderVideoWithFFmpeg(outputDir);
  }

  async retryVideoRendering(folderPath: string): Promise<string> {
    const retryTimer = new Timer('Retry renderização de vídeo');
    retryTimer.logStart();
    
    try {
      retryTimer.log(`🔄 Tentando renderizar vídeo novamente em: ${folderPath}`);
      
      // Verificar se a pasta existe
      try {
        await fs.access(folderPath);
      } catch (error) {
        throw new Error(`Pasta não encontrada: ${folderPath}`);
      }
      
      // Verificar se temos arquivos de áudio e imagem
      const audioFiles = await this.getAudioFiles(folderPath);
      const imageFiles = await this.getImageFiles(folderPath);
      
      if (audioFiles.length === 0) {
        throw new Error(`Nenhum arquivo de áudio encontrado em: ${folderPath}`);
      }
      
      if (imageFiles.length === 0) {
        throw new Error(`Nenhuma imagem encontrada em: ${folderPath}`);
      }
      
      retryTimer.log(`📊 Encontrados ${audioFiles.length} áudios e ${imageFiles.length} imagens`);
      retryTimer.log(`🎬 Iniciando renderização do vídeo...`);
      
      // Renderizar o vídeo
      const videoPath = await this.renderVideoWithFFmpeg(folderPath);
      
      retryTimer.logEnd();
      retryTimer.log(`✅ Vídeo renderizado com sucesso: ${videoPath}`);
      console.log(`\n🎯 TEMPO TOTAL DE RENDERIZAÇÃO: ${retryTimer.getElapsedTime()}`);
      
      // Tocar som de notificação quando a renderização terminar
      this.playNotificationSound();
      console.log('🔔 Renderização concluída! Som de notificação emitido.');
      
      return videoPath;
      
    } catch (error) {
      retryTimer.log(`❌ Erro ao renderizar vídeo: ${error.message}`);
      throw error;
    }
  }
}