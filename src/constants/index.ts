export const AUDIO_CONFIG = {
  SAMPLE_RATE: 24000,
  NUM_CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
  VOICE_NAME: 'Charon'
} as const;

export const BATCH_SIZES = {
  AUDIO_PROCESSING: 5,
  AUDIO_PROCESSING_FISH: 1, // Reduzir para 1 request por vez para economizar
  PROMPT_GENERATION: 5
} as const;

export const TIMEOUTS = {
  AUDIO_CONVERSION: 120000, // 2 minutes
  IMAGE_GENERATION: 30000,  // 30 seconds
  FFMPEG_COMMAND: 60000,    // 1 minute
  ENCODER_TEST: 5000        // 5 seconds para teste rápido de encoder
} as const;

export const FILE_PATTERNS = {
  YT_CODE: /YT(\d{2})/i,
  AUDIO_FILE: /output_audio_(\d+)\.wav/,
  IMAGE_FILE: /imagem_(\d+)\.jpg/
} as const;

/**
 * Delays configuráveis para diferentes operações
 * Todos os valores estão em milissegundos
 */
export const DELAYS = {
  // Delays entre tentativas
  BETWEEN_RETRIES: 1000, // 1 segundo entre retries normais
  RATE_LIMIT_BACKOFF: 2000, // 2 segundos após rate limit
  QUOTA_DAILY: 5000, // 5 segundos após quota diária esgotada
  
  // Delays entre batches
  BETWEEN_BATCHES_FISH: 3000, // 3 segundos para Fish Audio
  BETWEEN_BATCHES_GOOGLE_INITIAL: 10000, // 10 segundos para primeiro batch do Google
  BETWEEN_BATCHES_GOOGLE_INCREMENT: 5000, // Incremento de 5s por batch
  BETWEEN_BATCHES_GOOGLE_MAX: 30000, // 30 segundos máximo para Google (free tier)
  
  // Delays entre arquivos
  BETWEEN_FILES: 3000, // 3 segundos entre processamento de arquivos
  
  // Delays de renderização
  BETWEEN_IMAGES: 1500, // 1.5 segundos entre geração de imagens
  BETWEEN_THUMBNAILS: 1500, // 1.5 segundos entre thumbnails
  
  // Delays de retry
  BETWEEN_RETRY_BATCHES: 1000, // 1 segundo entre batches de retry paralelo
  
  // Delays de timer
  LIVE_TIMER_UPDATE_INTERVAL: 1000, // 1 segundo para atualização do timer em tempo real
  
  // Delays de processamento
  BETWEEN_PROMPT_BATCHES: 2000, // 2 segundos entre batches de geração de prompts
  
  // Delays de Whisk API
  WHISK_RETRY_BACKOFF_BASE: 2000, // 2 segundos base para backoff do Whisk
  WHISK_RETRY_BACKOFF_MULTIPLIER: 2, // Multiplicador para backoff exponencial do Whisk
} as const;

/**
 * Configurações de retry
 */
export const RETRY_CONFIG = {
  MAX_RETRIES_PER_KEY: 2, // Tentativas por API key
  MAX_TOTAL_RETRIES: 10, // Máximo total de tentativas
  BACKOFF_MULTIPLIER: 2, // Multiplicador para backoff exponencial
  MAX_BACKOFF: 30000, // Máximo de 30 segundos de backoff
  INITIAL_BACKOFF: 1000, // Backoff inicial em milissegundos
} as const;