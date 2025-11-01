export interface VoiceConfig {
  id: string;
  name: string;
  language: string;
  description: string;
  referenceId: string;
}

export interface VoiceSelection {
  selectedVoice: VoiceConfig;
  allVoices: VoiceConfig[];
}