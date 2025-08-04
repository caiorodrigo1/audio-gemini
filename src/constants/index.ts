export const AUDIO_CONFIG = {
  SAMPLE_RATE: 24000,
  NUM_CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
  VOICE_NAME: 'Algenib'
} as const;

export const BATCH_SIZES = {
  AUDIO_PROCESSING: 5,
  PROMPT_GENERATION: 5
} as const;

export const TIMEOUTS = {
  AUDIO_CONVERSION: 120000, // 2 minutes
  IMAGE_GENERATION: 30000,  // 30 seconds
  FFMPEG_COMMAND: 60000     // 1 minute
} as const;

export const FILE_PATTERNS = {
  YT_CODE: /YT(\d{2})/i,
  AUDIO_FILE: /output_audio_(\d+)\.wav/,
  IMAGE_FILE: /imagem_(\d+)\.jpg/
} as const;