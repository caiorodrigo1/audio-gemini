import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { loadEnvConfig } from '../config/env.config';
import { DEFAULT_GEMINI_VOICE_ID, GEMINI_VOICES } from '../config/gemini-voices.config';
import { LibraryVoice } from './dto';

const VOICES_URL = 'https://generativelanguage.googleapis.com/v1beta/voices';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const MAX_VOICES = 5000;

/**
 * Biblioteca de vozes do Gemini 3.8 TTS (GET /v1beta/voices).
 * Carrega todas as páginas uma vez e mantém em cache; se a API falhar,
 * cai para a lista estática de GEMINI_VOICES.
 */
@Injectable()
export class VoiceLibraryService {
  private cache: { voices: LibraryVoice[]; loadedAt: number } | null = null;
  private loading: Promise<LibraryVoice[]> | null = null;

  async list(): Promise<LibraryVoice[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.voices;
    }
    if (!this.loading) {
      this.loading = this.fetchAll()
        .then(voices => {
          this.cache = { voices, loadedAt: Date.now() };
          return voices;
        })
        .catch(err => {
          console.warn(`⚠️ Falha ao carregar biblioteca de vozes do Gemini: ${err.message}. Usando lista estática.`);
          return this.cache?.voices ?? staticVoices();
        })
        .finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  /** Retorna o id canônico da voz (case-insensitive) ou null se não existir. */
  async resolve(id: string): Promise<string | null> {
    const wanted = id.toLowerCase();
    const voice = (await this.list()).find(v => v.id.toLowerCase() === wanted);
    return voice?.id ?? null;
  }

  async defaultVoiceId(): Promise<string> {
    return (await this.resolve(DEFAULT_GEMINI_VOICE_ID)) ?? DEFAULT_GEMINI_VOICE_ID;
  }

  private async fetchAll(): Promise<LibraryVoice[]> {
    const keys = loadEnvConfig().googleApiKeys;
    let lastError: any;

    // Algumas keys podem estar bloqueadas (403) ou esgotadas; tenta a próxima
    for (const key of keys) {
      try {
        const raw: any[] = [];
        let pageToken: string | undefined;
        do {
          const res = await axios.get(VOICES_URL, {
            headers: { 'x-goog-api-key': key },
            params: { page_size: 1000, page_token: pageToken },
            timeout: 30000,
          });
          raw.push(...(res.data?.voices ?? []));
          pageToken = res.data?.next_page_token;
        } while (pageToken && raw.length < MAX_VOICES);

        if (raw.length === 0) throw new Error('Nenhuma voz retornada');
        return raw.map(normalizeVoice);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error('Nenhuma API key configurada');
  }
}

/**
 * persona vem como "Categoria / Subcategoria (Papel) | Outra Categoria (Papel)".
 * Os presets são as categorias principais; os papéis ficam em `roles`.
 */
export function parsePersona(persona: string | undefined): { presets: string[]; roles: string[] } {
  const presets = new Set<string>();
  const roles = new Set<string>();
  for (const part of (persona ?? '').split('|').map(p => p.trim()).filter(Boolean)) {
    const role = part.match(/\(([^)]+)\)/)?.[1]?.trim();
    const preset = part.replace(/\(.*\)/, '').split('/')[0].trim();
    if (preset) presets.add(preset);
    if (role) roles.add(role);
  }
  return { presets: [...presets], roles: [...roles] };
}

function normalizeVoice(v: any): LibraryVoice {
  const { presets, roles } = parsePersona(v.persona);
  return {
    id: String(v.id),
    name: String(v.display_name ?? v.id),
    languageCode: String(v.language_code ?? ''),
    accent: String(v.accent ?? ''),
    gender: String(v.gender ?? ''),
    pitch: String(v.pitch ?? ''),
    description: String(v.description ?? ''),
    presets,
    roles,
    // As 30 vozes de estúdio têm id simples (ex.: "charon") e funcionam em qualquer idioma
    studio: !String(v.id).includes('-'),
  };
}

function staticVoices(): LibraryVoice[] {
  return GEMINI_VOICES.map(v => ({
    id: v.id,
    name: v.name,
    languageCode: '',
    accent: '',
    gender: v.gender,
    pitch: '',
    description: v.description,
    presets: [],
    roles: [],
    studio: true,
  }));
}
