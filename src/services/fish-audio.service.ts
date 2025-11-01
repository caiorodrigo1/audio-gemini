import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadEnvConfig, EnvConfig } from '../config/env.config';
import { TextChunk } from '../interfaces/text-chunk.interface';
import { VoiceConfig } from '../interfaces/voice-config.interface';
import * as msgpack from 'msgpack5';

@Injectable()
export class FishAudioService {
  private readonly config: EnvConfig;
  private readonly baseUrl = 'https://api.fish.audio/v1';
  private readonly msgpackInstance = msgpack();
  private selectedVoice: VoiceConfig | null = null;
  private selectedModel: string = 'speech-1.6'; // Modelo padrão mais econômico

  constructor() {
    this.config = loadEnvConfig();
  }

  private get apiKeys(): string[] {
    return this.config.fishAudioApiKeys.length > 0 ? this.config.fishAudioApiKeys : 
           (this.config.fishAudioApiKey ? [this.config.fishAudioApiKey] : []);
  }

  private get referenceId(): string {
    // Usar a voz selecionada se disponível, senão usar a configuração padrão
    if (this.selectedVoice) {
      return this.selectedVoice.referenceId;
    }
    return this.config.fishAudioReferenceId || process.env.FISH_AUDIO_REFERENCE_ID || '';
  }

  setSelectedVoice(voice: VoiceConfig): void {
    this.selectedVoice = voice;
    console.log(`🎙️ Voz Fish Audio configurada: ${voice.name} (${voice.language})`);
  }

  setSelectedModel(model: string): void {
    this.selectedModel = model;
    console.log(`🤖 Modelo Fish Audio configurado: ${model}`);
  }

  async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
    // Tentar TODAS as API keys disponíveis em caso de resource exhausted
    const totalKeys = this.apiKeys.length;
    const maxRetries = totalKeys * 2; // 2 tentativas por API key
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Rotação através de TODAS as API keys disponíveis
      const apiKeyIndex = attempt % totalKeys;
      const currentApiKey = this.apiKeys[apiKeyIndex];
      
      try {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries} para chunk ${chunk.chunkIndex + 1} com API key ${apiKeyIndex + 1}/${totalKeys}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`🐟 Processando chunk ${chunk.chunkIndex + 1} com Fish Audio (modelo ${this.selectedModel}) - API key ${apiKeyIndex + 1}/${totalKeys}...`);
        }

        const payload = {
          reference_id: this.referenceId,
          text: chunk.text,
          format: 'wav',
          chunk_length: 200,
          model: this.selectedModel  // Usando o modelo selecionado
        };

        const packedData = this.msgpackInstance.encode(payload);

        const response = await axios.post(`${this.baseUrl}/tts`, packedData, {
          headers: {
            'Authorization': `Bearer ${currentApiKey}`,
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
        const isResourceExhausted = error.response?.status === 429 || 
                                   (error.message && error.message.toLowerCase().includes('resource'));
        
        console.error(`❌ Tentativa ${attempt + 1}/${maxRetries} falhou para chunk ${chunk.chunkIndex + 1} (API key ${apiKeyIndex + 1}):`, error.message);
        
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          if (error.response.data) {
            console.error(`Response:`, error.response.data.toString().substring(0, 200));
          }
        }
        
        if (isUnauthorized) {
          console.error(`❌ Erro de autenticação na API key ${apiKeyIndex + 1} - tentando próxima key`);
          if (attempt < maxRetries - 1) {
            continue;
          } else {
            console.error('💡 Configure FISH_AUDIO_API_KEY ou FISH_AUDIO_API_KEYS no arquivo .env');
            break;
          }
        }
        
        if (isRateLimit || isResourceExhausted) {
          console.log(`⏳ Rate limit/resource exhausted (API key ${apiKeyIndex + 1}), tentando próxima API key...`);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        if (isServerError && attempt < maxRetries - 1) {
          console.log(`🔄 Erro do servidor (API key ${apiKeyIndex + 1}), tentando próxima key...`);
          continue;
        }
        
        // Para outros erros, tentar próxima API key
        if (attempt < maxRetries - 1) {
          console.log(`🔄 Tentando com próxima API key...`);
          continue;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para chunk ${chunk.chunkIndex + 1}`);
    console.error(`📊 Tentaram-se todas as ${totalKeys} Fish Audio API keys disponíveis (${maxRetries / totalKeys} tentativas por key)`);
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
    
    if (this.apiKeys.length === 0) {
      errors.push('FISH_AUDIO_API_KEY ou FISH_AUDIO_API_KEYS não configurada(s) no arquivo .env');
    }
    
    this.apiKeys.forEach((key, index) => {
      if (key && key.length < 10) {
        errors.push(`Fish Audio API key ${index + 1} parece ser inválida (muito curta)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateVoiceConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.referenceId) {
      errors.push('Reference ID não configurado para a voz selecionada');
    }
    
    if (this.referenceId && this.referenceId.length < 10) {
      errors.push('Reference ID parece ser inválido (muito curto)');
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
        model: this.selectedModel
      };

      const testPackedData = this.msgpackInstance.encode(testPayload);

      const firstApiKey = this.apiKeys[0];
      const testResponse = await axios.post(`${this.baseUrl}/tts`, testPackedData, {
        headers: {
          'Authorization': `Bearer ${firstApiKey}`,
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
        console.error('💡 Verifique se suas FISH_AUDIO_API_KEY(S) estão corretas');
      } else if (error.response?.status === 400) {
        console.error('💡 Verifique se sua FISH_AUDIO_REFERENCE_ID está correta');
      }
      
      return false;
    }
  }
}