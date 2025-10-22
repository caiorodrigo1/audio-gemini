import { Injectable } from '@nestjs/common';
import * as readline from 'readline';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  cost: string;
  quality: string;
}

@Injectable()
export class ModelSelectorService {

  private readonly availableModels: ModelConfig[] = [
    {
      id: 'speech-1.6',
      name: 'Speech 1.6',
      description: 'Modelo estável e econômico - recomendado para produção',
      cost: '💰 Mais barato',
      quality: '⭐⭐⭐⭐ Boa qualidade'
    },
    {
      id: 'speech-1.5',
      name: 'Speech 1.5',
      description: 'Modelo padrão anterior - balanceado',
      cost: '💰💰 Médio',
      quality: '⭐⭐⭐ Qualidade padrão'
    },
    {
      id: 's1',
      name: 'OpenAudio S1',
      description: 'Modelo flagship com melhor qualidade - mais caro',
      cost: '💰💰💰 Mais caro',
      quality: '⭐⭐⭐⭐⭐ Melhor qualidade'
    }
  ];

  async selectModel(): Promise<ModelConfig> {
    console.log('\n🤖 ===== SELEÇÃO DE MODELO FISH AUDIO =====');
    console.log('Modelos disponíveis:');
    console.log('');

    // Listar todos os modelos disponíveis
    this.availableModels.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      console.log(`   ${model.description}`);
      console.log(`   ${model.cost} | ${model.quality}`);
      console.log('');
    });

    console.log('💡 Recomendação: Speech 1.6 para economia máxima');
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const promptUser = () => {
        rl.question('Escolha um modelo (número) ou pressione Enter para Speech 1.6: ', (answer: string) => {
          const choice = answer.trim();
          
          if (!choice) {
            // Usar modelo padrão (Speech 1.6)
            const defaultModel = this.availableModels[0];
            console.log(`🤖 Usando modelo padrão: ${defaultModel.name} (${defaultModel.cost})`);
            rl.close();
            resolve(defaultModel);
            return;
          }

          const index = parseInt(choice) - 1;
          
          if (isNaN(index) || index < 0 || index >= this.availableModels.length) {
            console.log('❌ Opção inválida. Tente novamente.');
            promptUser();
            return;
          }

          const selectedModel = this.availableModels[index];
          console.log(`🤖 Modelo selecionado: ${selectedModel.name} (${selectedModel.cost})`);
          rl.close();
          resolve(selectedModel);
        });
      };

      promptUser();
    });
  }

  getDefaultModel(): ModelConfig {
    return this.availableModels[0]; // Speech 1.6 como padrão
  }

  displayModelInfo(model: ModelConfig): void {
    console.log(`🤖 Usando modelo: ${model.name}`);
    console.log(`💰 Custo: ${model.cost}`);
    console.log(`⭐ Qualidade: ${model.quality}`);
    console.log('');
  }
}