export type RenderPreset = 'standard' | 'fast';

export interface RenderSettings {
  preset: string; // Preset NVENC (p1, p4, etc)
  tune: string;   // Tune NVENC (hq, ll, etc)
}

export function getRenderSettings(preset: RenderPreset): RenderSettings {
  switch (preset) {
    case 'fast':
      return {
        preset: 'p1', // Mais rápido (2-3x mais rápido que p4)
        tune: 'll'    // Low latency - otimizado para velocidade
      };
    case 'standard':
    default:
      return {
        preset: 'p4', // Padrão atual (balanceado)
        tune: 'hq'    // High quality
      };
  }
}

