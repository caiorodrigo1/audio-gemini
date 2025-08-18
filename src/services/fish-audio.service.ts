import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadEnvConfig, EnvConfig } from '../config/env.config';
import { TextChunk } from '../interfaces/text-chunk.interface';
import * as msgpack from 'msgpack5';

@Injectable()
export class FishAudioService {
  private readonly config: EnvConfig;
  private readonly baseUrl = 'https://api.fish.audio/v1';
  private readonly msgpackInstance = msgpack();

  constructor() {
    this.config = loadEnvConfig();
  }

  private get apiKey(): string {
    return this.config.fishAudioApiKey || process.env.FISH_AUDIO_API_KEY || '';
  }

  private get referenceId(): string {
    return this.config.fishAudioReferenceId || process.env.FISH_AUDIO_REFERENCE_ID || '';
  }

  async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries} para chunk ${chunk.chunkIndex + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else {
          console.log(`🐟 Processando chunk ${chunk.chunkIndex + 1} com Fish Audio (modelo S1)...`);
        }

        const payload = {
          reference_id: this.referenceId,
          text: chunk.text,
          format: 'wav',
          chunk_length: 200,
          model: 's1'  // Usando o modelo S1 (OpenAudio S1 - 4B parameters)
        };

        const packedData = this.msgpackInstance.encode(payload);

        const response = await axios.post(`${this.baseUrl}/tts`, packedData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/msgpack'
          },
          responseType: 'arraybuffer',
          timeout: 60000 // 60 segundos
        });

        if (attempt > 0) {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso na tentativa ${attempt + 1}!`);
        } else {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso!`);
        }

        return Buffer.from(response.data);
        
      } catch (error) {
        lastError = error;
        const isRateLimit = error.response?.status === 429;
        const isUnauthorized = error.response?.status === 401;
        const isServerError = error.response?.status >= 500;
        
        console.error(`❌ Tentativa ${attempt + 1} falhou para chunk ${chunk.chunkIndex + 1}:`, error.message);
        
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          if (error.response.data) {
            console.error(`Response:`, error.response.data.toString().substring(0, 200));
          }
        }
        
        if (isUnauthorized) {
          console.error('❌ Erro de autenticação - verifique sua API key do Fish Audio');
          console.error('💡 Configure FISH_AUDIO_API_KEY no arquivo .env');
          break;
        }
        
        if (isRateLimit) {
          console.log(`⏳ Rate limit atingido, aguardando antes da próxima tentativa...`);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
            continue;
          }
        }
        
        if (isServerError && attempt < maxRetries - 1) {
          console.log(`🔄 Erro do servidor, tentando novamente...`);
          continue;
        }
        
        // Para outros erros, não tentar novamente
        if (!isRateLimit && !isServerError && attempt < maxRetries - 1) {
          console.log(`🔄 Tentando novamente...`);
          continue;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para chunk ${chunk.chunkIndex + 1}`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.status, lastError.response.statusText);
    }
    throw lastError;
  }

  async saveAudioFile(audioBuffer: Buffer, chunkIndex: number, outputDir: string): Promise<string> {
    const fileName = `output_audio_${chunkIndex}.wav`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, audioBuffer);
    return filePath;
  }

  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.apiKey) {
      errors.push('FISH_AUDIO_API_KEY não configurada no arquivo .env');
    }
    
    if (!this.referenceId) {
      errors.push('FISH_AUDIO_REFERENCE_ID não configurada no arquivo .env');
    }
    
    if (this.apiKey && this.apiKey.length < 10) {
      errors.push('FISH_AUDIO_API_KEY parece ser inválida (muito curta)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testando conexão com Fish Audio API...');
      
      const testPayload = {
        reference_id: this.referenceId,
        text: 'Test audio generation',
        format: 'wav',
        model: 's1'
      };

      const testPackedData = this.msgpackInstance.encode(testPayload);

      const testResponse = await axios.post(`${this.baseUrl}/tts`, testPackedData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/msgpack'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      console.log('✅ Conexão com Fish Audio API estabelecida com sucesso!');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao testar conexão com Fish Audio:', error.message);
      
      if (error.response?.status === 401) {
        console.error('💡 Verifique se sua FISH_AUDIO_API_KEY está correta');
      } else if (error.response?.status === 400) {
        console.error('💡 Verifique se sua FISH_AUDIO_REFERENCE_ID está correta');
      }
      
      return false;
    }
  }
}