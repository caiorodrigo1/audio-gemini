// src/config/gemini-voices.config.ts
export type GeminiVoiceGender = 'male' | 'female';

export interface GeminiVoice {
  id: string;
  name: string;
  gender: GeminiVoiceGender;
  description: string;
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: 'Charon', name: 'Charon', gender: 'male',   description: 'Voz masculina grave e informativa' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male',   description: 'Voz masculina firme e expressiva' },
  { id: 'Orus',   name: 'Orus',   gender: 'male',   description: 'Voz masculina clara e neutra' },
  { id: 'Puck',   name: 'Puck',   gender: 'male',   description: 'Voz masculina jovem e dinâmica' },
  { id: 'Aoede',  name: 'Aoede',  gender: 'female', description: 'Voz feminina suave e melódica' },
  { id: 'Kore',   name: 'Kore',   gender: 'female', description: 'Voz feminina clara e neutra' },
  { id: 'Leda',   name: 'Leda',   gender: 'female', description: 'Voz feminina calma e narrativa' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'female', description: 'Voz feminina leve e expressiva' },
];

export const DEFAULT_GEMINI_VOICE_ID = 'Charon';

export function isValidVoiceId(id: string): boolean {
  return GEMINI_VOICES.some(v => v.id === id);
}

export function groupedVoices() {
  return {
    male:   GEMINI_VOICES.filter(v => v.gender === 'male').map(({ id, name, description }) => ({ id, name, description })),
    female: GEMINI_VOICES.filter(v => v.gender === 'female').map(({ id, name, description }) => ({ id, name, description })),
    default: DEFAULT_GEMINI_VOICE_ID,
  };
}
