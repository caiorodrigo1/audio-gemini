import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  openaiApiKey: string;
  whiskToken: string;
  googleApiKeys: string[];
  maxChunkLength: number;
  defaultOutputDir: string;
}

export const loadEnvConfig = (): EnvConfig => {
  const googleApiKeysString = process.env.GOOGLE_API_KEYS || '';
  const googleApiKeys = googleApiKeysString
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);

  if (googleApiKeys.length === 0) {
    throw new Error('GOOGLE_API_KEYS não encontradas no arquivo .env');
  }

  const config: EnvConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    whiskToken: process.env.WHISK_TOKEN || '',
    googleApiKeys,
    maxChunkLength: parseInt(process.env.MAX_CHUNK_LENGTH || '1500', 10),
    defaultOutputDir: process.env.DEFAULT_OUTPUT_DIR || 'D:\\Canais Dark'
  };

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não encontrada no arquivo .env');
  }

  if (!config.whiskToken) {
    throw new Error('WHISK_TOKEN não encontrado no arquivo .env');
  }

  return config;
};