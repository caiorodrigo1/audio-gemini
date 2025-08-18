import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  openaiApiKey: string;
  whiskToken: string;
  googleApiKeys: string[];
  maxChunkLength: number;
  defaultOutputDir: string;
  fishAudioApiKey: string;
  fishAudioReferenceId: string;
}

export const loadEnvConfig = (): EnvConfig => {
  const useFishAudio = process.argv.includes('--fish-audio');
  
  const googleApiKeysString = process.env.GOOGLE_API_KEYS || '';
  const googleApiKeys = googleApiKeysString
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);

  // Só validar Google API Keys se não estiver usando Fish Audio
  if (!useFishAudio && googleApiKeys.length === 0) {
    throw new Error('GOOGLE_API_KEYS não encontradas no arquivo .env');
  }

  const config: EnvConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    whiskToken: process.env.WHISK_TOKEN || '',
    googleApiKeys,
    maxChunkLength: parseInt(process.env.MAX_CHUNK_LENGTH || '1500', 10),
    defaultOutputDir: process.env.DEFAULT_OUTPUT_DIR || 'D:\\Canais Dark',
    fishAudioApiKey: process.env.FISH_AUDIO_API_KEY || '',
    fishAudioReferenceId: process.env.FISH_AUDIO_REFERENCE_ID || ''
  };

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não encontrada no arquivo .env');
  }

  // Só validar Whisk Token se não estiver usando Fish Audio
  if (!useFishAudio && !config.whiskToken) {
    throw new Error('WHISK_TOKEN não encontrado no arquivo .env');
  }

  // Validar configurações do Fish Audio se estiver usando
  if (useFishAudio) {
    if (!config.fishAudioApiKey) {
      throw new Error('FISH_AUDIO_API_KEY não encontrada no arquivo .env (necessária para modo --fish-audio)');
    }
    if (!config.fishAudioReferenceId) {
      throw new Error('FISH_AUDIO_REFERENCE_ID não encontrada no arquivo .env (necessária para modo --fish-audio)');
    }
  }

  return config;
};