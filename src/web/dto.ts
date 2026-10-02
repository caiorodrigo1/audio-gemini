export interface GenerateRequestBody {
  text?: unknown;
  voiceName?: unknown;
}

export interface GenerateResponse {
  jobId: string;
}

export interface LibraryVoice {
  id: string;
  name: string;
  languageCode: string;
  accent: string;
  gender: string;
  pitch: string;
  description: string;
  /** Categorias de persona (ex.: "Storyteller & Narrator") */
  presets: string[];
  /** Papéis da persona (ex.: "Nature Documentary Narrator") */
  roles: string[];
  /** Voz de estúdio multilíngue (as 30 vozes clássicas) */
  studio: boolean;
}

export interface VoicesResponse {
  voices: LibraryVoice[];
  default: string;
}
