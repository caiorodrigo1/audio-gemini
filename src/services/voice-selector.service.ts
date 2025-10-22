import { Injectable } from '@nestjs/common';
import * as readline from 'readline';
import { VoiceConfig, VoiceSelection } from '../interfaces/voice-config.interface';
import { AVAILABLE_VOICES, getDefaultVoice } from '../config/voices.config';

@Injectable()
export class VoiceSelectorService {

  async selectVoice(): Promise<VoiceSelection> {
    console.log('\n🎙️ ===== SELEÇÃO DE VOZ FISH AUDIO =====');
    console.log('Vozes disponíveis:');
    console.log('');

    // Listar todas as vozes disponíveis
    AVAILABLE_VOICES.forEach((voice, index) => {
      const status = this.isVoiceConfigured(voice) ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${voice.name} (${voice.language})`);
      console.log(`   ${voice.description}`);
      console.log('');
    });

    console.log('💡 ✅ = Configurada e pronta para uso');
    console.log('💡 ❌ = Precisa configurar o Reference ID');
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const promptUser = () => {
        rl.question('Escolha uma voz (número) ou pressione Enter para usar a padrão: ', (answer: string) => {
          const choice = answer.trim();
          
          if (!choice) {
            // Usar voz padrão
            const defaultVoice = getDefaultVoice();
            console.log(`🎙️ Usando voz padrão: ${defaultVoice.name} (${defaultVoice.language})`);
            rl.close();
            resolve({
              selectedVoice: defaultVoice,
              allVoices: AVAILABLE_VOICES
            });
            return;
          }

          const index = parseInt(choice) - 1;
          
          if (isNaN(index) || index < 0 || index >= AVAILABLE_VOICES.length) {
            console.log('❌ Opção inválida. Tente novamente.');
            promptUser();
            return;
          }

          const selectedVoice = AVAILABLE_VOICES[index];
          
          if (!this.isVoiceConfigured(selectedVoice)) {
            console.log(`❌ A voz "${selectedVoice.name}" não está configurada.`);
            console.log(`💡 Configure o Reference ID no arquivo de vozes ou no .env como:`);
            console.log(`   FISH_AUDIO_REFERENCE_ID_${selectedVoice.id.toUpperCase()}=seu_reference_id`);
            console.log('');
            promptUser();
            return;
          }

          console.log(`🎙️ Voz selecionada: ${selectedVoice.name} (${selectedVoice.language})`);
          rl.close();
          resolve({
            selectedVoice,
            allVoices: AVAILABLE_VOICES
          });
        });
      };

      promptUser();
    });
  }

  private isVoiceConfigured(voice: VoiceConfig): boolean {
    // Verificar se o reference ID não é um placeholder
    return voice.referenceId && 
           !voice.referenceId.includes('cole_aqui') && 
           voice.referenceId.length > 10;
  }

  async selectVoiceAutomatically(languageHint?: string): Promise<VoiceSelection> {
    // Para seleção automática baseada em dica de idioma ou usar padrão
    let selectedVoice = getDefaultVoice();
    
    if (languageHint) {
      const voiceByLanguage = AVAILABLE_VOICES.find(voice => 
        voice.language.toLowerCase().includes(languageHint.toLowerCase()) &&
        this.isVoiceConfigured(voice)
      );
      
      if (voiceByLanguage) {
        selectedVoice = voiceByLanguage;
        console.log(`🎙️ Voz selecionada automaticamente: ${selectedVoice.name} (${selectedVoice.language})`);
      }
    }

    return {
      selectedVoice,
      allVoices: AVAILABLE_VOICES
    };
  }

  displayVoiceInfo(voice: VoiceConfig): void {
    console.log(`🎙️ Usando voz: ${voice.name}`);
    console.log(`🌍 Idioma: ${voice.language}`);
    console.log(`🔧 Reference ID: ${voice.referenceId.substring(0, 15)}...`);
    console.log('');
  }
}