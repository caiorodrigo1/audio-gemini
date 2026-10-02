import { Inject, Injectable } from '@nestjs/common';
import { TTSService } from '../services/tts.service';
import { VoiceLibraryService } from './voice-library.service';

const MAX_CACHED = 200;

const SAMPLES: Record<string, string> = {
  pt: 'Olá! Esta é uma prévia da minha voz. Era uma vez, numa pequena fazenda no interior, uma história que ninguém esqueceu.',
  en: 'Hello! This is a preview of my voice. Once upon a time, on a small farm in the countryside, there was a story no one ever forgot.',
  es: '¡Hola! Esta es una muestra de mi voz. Había una vez, en una pequeña granja del campo, una historia que nadie olvidó.',
  de: 'Hallo! Das ist eine Hörprobe meiner Stimme. Es war einmal, auf einem kleinen Bauernhof auf dem Land, eine Geschichte, die niemand je vergaß.',
  fr: 'Bonjour ! Voici un aperçu de ma voix. Il était une fois, dans une petite ferme à la campagne, une histoire que personne n’a oubliée.',
  it: 'Ciao! Questa è un’anteprima della mia voce. C’era una volta, in una piccola fattoria di campagna, una storia che nessuno ha mai dimenticato.',
};

/** Gera (e guarda em memória) uma amostra curta de cada voz para o botão ▶ da UI. */
@Injectable()
export class VoicePreviewService {
  private readonly cache = new Map<string, Promise<Buffer>>();

  constructor(
    @Inject(TTSService) private readonly tts: TTSService,
    @Inject(VoiceLibraryService) private readonly voiceLibrary: VoiceLibraryService,
  ) {}

  get(voiceId: string): Promise<Buffer> {
    let pending = this.cache.get(voiceId);
    if (!pending) {
      pending = this.generate(voiceId);
      pending.catch(() => this.cache.delete(voiceId));
      this.cache.set(voiceId, pending);
      if (this.cache.size > MAX_CACHED) {
        this.cache.delete(this.cache.keys().next().value as string);
      }
    }
    return pending;
  }

  private async generate(voiceId: string): Promise<Buffer> {
    const voice = (await this.voiceLibrary.list()).find(v => v.id === voiceId);
    // Vozes de estúdio são multilíngues: amostra em português
    const lang = voice && !voice.studio ? voice.languageCode.slice(0, 2) : 'pt';
    const text = SAMPLES[lang] ?? SAMPLES.en;

    await this.tts.setUseFishAudio(false);
    const pcm = await this.tts.convertToSpeech({ text, chunkIndex: 0, apiKey: '' }, voiceId);
    return this.tts.convertToWav(pcm);
  }
}
