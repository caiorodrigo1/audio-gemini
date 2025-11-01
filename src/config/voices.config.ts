import { VoiceConfig } from '../interfaces/voice-config.interface';

export const AVAILABLE_VOICES: VoiceConfig[] = [
  {
    id: 'spanish_male',
    name: 'Espanhol Masculino',
    language: 'ES',
    description: 'Voz masculina espanhola - ideal para conteúdo em espanhol',
    referenceId: '3f45a7fd7a614655a61eb7027b955783'
  },
  {
    id: 'portuguese_male',
    name: 'Português Masculino',
    language: 'PT-BR', 
    description: 'Voz masculina brasileira - ideal para conteúdo em português',
    referenceId: 'a35003f7cc784a989bf2d54db0d93f8f'
  },
  {
    id: 'english_male',
    name: 'Inglês Masculino',
    language: 'EN-US',
    description: 'Voz masculina americana - ideal para conteúdo em inglês',
    referenceId: 'cole_aqui_seu_reference_id_ingles'
  },
  {
    id: 'italian_male',
    name: 'Italiano Masculino', 
    language: 'IT',
    description: 'Voz masculina italiana - ideal para conteúdo em italiano',
    referenceId: 'cole_aqui_seu_reference_id_italiano'
  },
  {
    id: 'polish_male',
    name: 'Polonês Masculino',
    language: 'PL', 
    description: 'Voz masculina polonesa - ideal para conteúdo em polonês',
    referenceId: 'cole_aqui_seu_reference_id_polones'
  },
  {
    id: 'romanian_male',
    name: 'Romeno Masculino',
    language: 'RO',
    description: 'Voz masculina romena - ideal para conteúdo em romeno', 
    referenceId: 'cole_aqui_seu_reference_id_romeno'
  },
  {
    id: 'german_male',
    name: 'Alemão Masculino',
    language: 'DE',
    description: 'Voz masculina alemã - ideal para conteúdo em alemão',
    referenceId: '90042f762dbf49baa2e7776d011eee6b'
  }
];

export const getVoiceByLanguage = (language: string): VoiceConfig | null => {
  return AVAILABLE_VOICES.find(voice => voice.language === language) || null;
};

export const getVoiceById = (id: string): VoiceConfig | null => {
  return AVAILABLE_VOICES.find(voice => voice.id === id) || null;
};

export const getDefaultVoice = (): VoiceConfig => {
  return AVAILABLE_VOICES[0]; // Espanhol como padrão
};