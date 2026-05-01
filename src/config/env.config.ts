import * as dotenv from 'dotenv';
import * as os from 'os';

dotenv.config();

export interface EnvConfig {
  openaiApiKey: string;
  whiskToken: string;
  flowToken: string;
  googleApiKeys: string[];
  maxChunkLength: number;
  defaultOutputDir: string;
  fishAudioApiKey: string;
  fishAudioApiKeys: string[];
  fishAudioReferenceId: string;
}

export const loadEnvConfig = (): EnvConfig => {
  const useFishAudio = process.argv.includes('--fish-audio');
  const useFlow = process.argv.includes('--flow');

  const googleApiKeysString = process.env.GOOGLE_API_KEYS || '';
  const googleApiKeys = googleApiKeysString
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);

  // Configurar múltiplas Fish Audio API keys
  const fishAudioApiKeysString = process.env.FISH_AUDIO_API_KEYS || process.env.FISH_AUDIO_API_KEY || '';
  const fishAudioApiKeys = fishAudioApiKeysString
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);

  // Só validar Google API Keys se não estiver usando Fish Audio
  if (!useFishAudio && googleApiKeys.length === 0) {
    throw new Error('GOOGLE_API_KEYS não encontradas no arquivo .env');
  }

  // Detectar plataforma e usar caminho padrão apropriado
  const platform = os.platform();
  const defaultOutputDir = process.env.DEFAULT_OUTPUT_DIR ||
    (platform === 'darwin' ? '/Users/caiosantos/Movies' : 'D:\\Canais Dark');

  const config: EnvConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    whiskToken: process.env.WHISK_TOKEN || '',
    flowToken: process.env.FLOW_TOKEN || '',
    googleApiKeys,
    maxChunkLength: parseInt(process.env.MAX_CHUNK_LENGTH || '4500', 10), // Chunks maiores para Fish Audio
    defaultOutputDir,
    fishAudioApiKey: process.env.FISH_AUDIO_API_KEY || '',
    fishAudioApiKeys,
    fishAudioReferenceId: process.env.FISH_AUDIO_REFERENCE_ID || ''
  };

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não encontrada no arquivo .env');
  }

  // Validar token de imagem se não estiver usando Fish Audio
  if (!useFishAudio) {
    if (useFlow && !config.flowToken) {
      throw new Error('FLOW_TOKEN não encontrado no arquivo .env (necessário para modo --flow)');
    } else if (!useFlow && !config.whiskToken) {
      throw new Error('WHISK_TOKEN não encontrado no arquivo .env');
    }
  }

  // Validar configurações do Fish Audio se estiver usando
  if (useFishAudio) {
    if (config.fishAudioApiKeys.length === 0) {
      throw new Error('FISH_AUDIO_API_KEY ou FISH_AUDIO_API_KEYS não encontrada(s) no arquivo .env (necessária para modo --fish-audio)');
    }
  }

  return config;
};