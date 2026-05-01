import { Provider } from '@nestjs/common';
import { TTSService } from '../services/tts.service';

export const TTS_RUNNER = Symbol('TTS_RUNNER');

export const ttsRunnerProvider: Provider = {
  provide: TTS_RUNNER,
  inject: [TTSService],
  useFactory: (tts: TTSService) => {
    return async (text: string, voiceName: string, onProgress: any) => {
      await tts.setUseFishAudio(false);
      return tts.generateFromText(text, voiceName, onProgress);
    };
  },
};
