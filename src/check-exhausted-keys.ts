import axios from 'axios';
import { loadEnvConfig } from './config/env.config';
import { AUDIO_CONFIG } from './constants';

interface KeyStatus {
  index: number;
  key: string;
  status: 'working' | 'exhausted' | 'error';
  error?: string;
}

async function testApiKey(apiKey: string, index: number): Promise<KeyStatus> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?key=${apiKey}`;
  
  // Texto de teste curto para não consumir muito
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "test"
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["audio"],
      temperature: 1,
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: AUDIO_CONFIG.VOICE_NAME
          }
        }
      }
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });

    return {
      index,
      key: apiKey.substring(0, 20) + '...',
      status: 'working'
    };
  } catch (error: any) {
    const isResourceExhausted = 
      error.response?.data?.[0]?.error?.code === 429 ||
      error.response?.data?.[0]?.error?.status === 'RESOURCE_EXHAUSTED' ||
      error.response?.status === 429 ||
      (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

    if (isResourceExhausted) {
      return {
        index,
        key: apiKey.substring(0, 20) + '...',
        status: 'exhausted',
        error: error.response?.data?.[0]?.error?.message || 'RESOURCE_EXHAUSTED'
      };
    }

    return {
      index,
      key: apiKey.substring(0, 20) + '...',
      status: 'error',
      error: error.message || 'Unknown error'
    };
  }
}

async function checkExhaustedKeys() {
  console.log('🔍 Verificando status das API keys...\n');
  
  const config = loadEnvConfig();
  const apiKeys = config.googleApiKeys;
  
  if (apiKeys.length === 0) {
    console.error('❌ Nenhuma API key encontrada no arquivo .env');
    return;
  }

  console.log(`📊 Total de API keys: ${apiKeys.length}\n`);
  console.log('⏳ Testando cada key (isso pode levar alguns minutos)...\n');

  const results: KeyStatus[] = [];
  const exhaustedKeys: KeyStatus[] = [];
  const errorKeys: KeyStatus[] = [];
  const workingKeys: KeyStatus[] = [];

  // Testar todas as keys sequencialmente para evitar rate limit
  for (let i = 0; i < apiKeys.length; i++) {
    process.stdout.write(`\r🔑 Testando key ${i + 1}/${apiKeys.length}...`);
    
    const result = await testApiKey(apiKeys[i], i);
    results.push(result);

    if (result.status === 'exhausted') {
      exhaustedKeys.push(result);
    } else if (result.status === 'error') {
      errorKeys.push(result);
    } else {
      workingKeys.push(result);
    }

    // Pequeno delay entre testes para evitar rate limit
    if (i < apiKeys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n\n📊 RESULTADO DA VERIFICAÇÃO:\n');
  console.log('═'.repeat(60));
  
  // Resumo
  console.log(`\n✅ Keys funcionando: ${workingKeys.length}`);
  console.log(`⚠️  Keys esgotadas (RESOURCE_EXHAUSTED): ${exhaustedKeys.length}`);
  console.log(`❌ Keys com erro: ${errorKeys.length}`);
  console.log(`📊 Total: ${apiKeys.length}\n`);

  // Listar keys esgotadas
  if (exhaustedKeys.length > 0) {
    console.log('🔴 API KEYS ESGOTADAS (RESOURCE_EXHAUSTED):');
    console.log('─'.repeat(60));
    exhaustedKeys.forEach(key => {
      console.log(`   Key #${key.index + 1}: ${key.key}`);
      if (key.error) {
        console.log(`      Erro: ${key.error}`);
      }
    });
    console.log('');
  }

  // Listar keys com erro (não exhausted)
  if (errorKeys.length > 0) {
    console.log('⚠️  API KEYS COM ERRO (não esgotadas):');
    console.log('─'.repeat(60));
    errorKeys.forEach(key => {
      console.log(`   Key #${key.index + 1}: ${key.key}`);
      console.log(`      Erro: ${key.error}`);
    });
    console.log('');
  }

  // Listar índices das keys esgotadas
  if (exhaustedKeys.length > 0) {
    const exhaustedIndexes = exhaustedKeys.map(k => k.index + 1).sort((a, b) => a - b);
    console.log('📋 ÍNDICES DAS KEYS ESGOTADAS:');
    console.log(`   ${exhaustedIndexes.join(', ')}\n`);
  }

  // Estatísticas
  const workingPercentage = ((workingKeys.length / apiKeys.length) * 100).toFixed(1);
  const exhaustedPercentage = ((exhaustedKeys.length / apiKeys.length) * 100).toFixed(1);
  
  console.log('📈 ESTATÍSTICAS:');
  console.log(`   Taxa de sucesso: ${workingPercentage}%`);
  console.log(`   Taxa de esgotamento: ${exhaustedPercentage}%`);
  
  if (exhaustedKeys.length > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${exhaustedKeys.length} key(s) esgotada(s) não serão usadas automaticamente.`);
    console.log(`   Considere remover ou substituir essas keys do arquivo .env\n`);
  }
}

// Executar
checkExhaustedKeys().catch(error => {
  console.error('❌ Erro ao verificar keys:', error.message);
  process.exit(1);
});
















