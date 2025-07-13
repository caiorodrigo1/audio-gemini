import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface TextChunk {
  text: string;
  chunkIndex: number;
  apiKey: string;
}

@Injectable()
export class TTSService {
  private readonly openaiApiKey = "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";
  private whiskToken = "ya29.a0AS3H6NwqSsOtjUwrEJL44ydVim9dbHbGGW_JfKZlxS-vfgRVvi5c4fSu8G4XakRS71SLZQxorh4qWSHeEp0Pjcz19aAfvs7V2lG6YiTY60mpzMxj10fEHLnGkdY64CwzpGGm1Tupd8SR0LuUnN9bfLIrbsEr40p1XMye7deaCo9Vnzctquf-1sxoxYbVNmj6puTR-i5K-7x5yjaPgkIplZ8MWTw4WzIz-GRzQsKgb39mzU6F6GSbGjWEdxgphZjcQ95Er1hw9ZGIWfW6Q6DbUD30qxEA-RtkFj4q13kLTEUqSy2nff0WPnZSp_5PtKGRIble9V8464vYvwaCgYKAVgSARISFQHGX2MicgIRxgKa2nv5CY5DKEbLZA0341";
  private consoleService: any; // Referência para o console service

  setConsoleService(consoleService: any) {
    this.consoleService = consoleService;
  }

  updateWhiskToken(newToken: string) {
    this.whiskToken = newToken;
    console.log('✅ Token atualizado com sucesso!');
  }
  
  // private readonly apiKeys = [
  //   "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
  //   "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
  //   "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
  //   "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
  //   "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
  //   "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
  //   "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
  //   "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
  //   "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
  //   "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
  //   "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
  //   "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
  //   "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
  //   "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
  //   "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88",
  //   "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
  //   "AIzaSyDy-wAc8vbLvpv4sBf60MMweBzaDYTWPaA",
  //   "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
  //   "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
  //   "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
  //   "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
  //   "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
  //   "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
  //   "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk"
  // ];

  private readonly apiKeys = [
    "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk",
    "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
    "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
    "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
    "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
    "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
    "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
    "AIzaSyDy-wAc8vbLvpv4sBf60MMweBzaDYTWPaA",
    "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
    "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
    "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
    "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
    "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
    "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
    "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
    "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
    "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
    "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
    "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
    "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
    "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
    "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
    "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
    "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88"
  ];

  // private readonly apiKeys = [
  //   "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
  //   "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
  //   "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
  //   "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
  //   "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
  //   "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
  //   "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88",
  //   "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
  //   "AIzaSyDy-wAc8vbLvpv4sBf60MMweBzaDYTWPaA",
  //   "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
  //   "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
  //   "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
  //   "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
  //   "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
  //   "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
  //   "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
  //   "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
  //   "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
  //   "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
  //   "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
  //   "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
  //   "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
  //   "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
  //   "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk"
  // ];

  private readonly maxLength = 3000;

  splitTextIntoChunks(text: string): TextChunk[] {
    console.log(`Texto recebido com ${text.length} caracteres`);
    const cleanText = text.replace(/["""]/g, '').replace(/[''']/g, '');
    console.log(`Texto limpo com ${cleanText.length} caracteres`);
    const chunks: TextChunk[] = [];
    let remainingText = cleanText;
    let chunkIndex = 0;

    while (remainingText.length > 0) {
      if (remainingText.length <= this.maxLength) {
        chunks.push({
          text: remainingText,
          chunkIndex,
          apiKey: this.apiKeys[chunkIndex % this.apiKeys.length]
        });
        break;
      }

      let cutIndex = -1;
      const lastPeriodIndex = remainingText.substring(0, this.maxLength).lastIndexOf('.');
      
      if (lastPeriodIndex !== -1) {
        cutIndex = lastPeriodIndex + 1;
      } else {
        const lastSpaceIndex = remainingText.substring(0, this.maxLength).lastIndexOf(' ');
        cutIndex = lastSpaceIndex !== -1 ? lastSpaceIndex : this.maxLength;
      }

      chunks.push({
        text: remainingText.substring(0, cutIndex).trim(),
        chunkIndex,
        apiKey: this.apiKeys[chunkIndex % this.apiKeys.length]
      });

      remainingText = remainingText.substring(cutIndex).trim();
      chunkIndex++;
    }

    return chunks;
  }

  async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Escolher uma API key diferente a cada tentativa
      const apiKeyIndex = (this.apiKeys.indexOf(chunk.apiKey) + attempt) % this.apiKeys.length;
      const currentApiKey = this.apiKeys[apiKeyIndex];
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?key=${currentApiKey}`;
      
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: chunk.text
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
                voice_name: "Algenib"
              }
            }
          }
        }
      };

      try {
        if (attempt > 0) {
          console.log(`Tentativa ${attempt + 1} para chunk ${chunk.chunkIndex + 1} com API key ${apiKeyIndex + 1}...`);
          // Delay adicional nas tentativas subsequentes
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // A resposta é um array, pegar o primeiro elemento
        const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
        
        // Verificar se a resposta tem a estrutura esperada
        if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
          throw new Error(`Resposta inválida da API: ${JSON.stringify(responseData)}`);
        }

        const audioData = responseData.candidates[0].content.parts[0].inlineData.data;
        if (attempt > 0) {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso na tentativa ${attempt + 1}!`);
        }
        return Buffer.from(audioData, 'base64');
        
      } catch (error) {
        lastError = error;
        const isRateLimit = error.response?.status === 429;
        const isQuotaError = error.response?.data?.[0]?.error?.code === 429;
        
        console.error(`❌ Tentativa ${attempt + 1} falhou para chunk ${chunk.chunkIndex + 1}:`, error.message);
        
        if (isRateLimit || isQuotaError) {
          console.log(`🔄 Rate limit/quota excedida, tentando com próxima API key...`);
          if (attempt < maxRetries - 1) {
            continue; // Tentar próxima API key
          }
        } else {
          // Erro que não é de rate limit - não tentar novamente
          break;
        }
      }
    }
    
    console.error(`❌ Todas as tentativas falharam para chunk ${chunk.chunkIndex + 1}`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    throw lastError;
  }

  convertToWav(rawBuffer: Buffer): Buffer {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const wavHeaderSize = 44;
    const dataSize = rawBuffer.length;
    const fileSize = wavHeaderSize + dataSize - 8;
    
    const header = Buffer.alloc(wavHeaderSize);
    
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, rawBuffer]);
  }

  async saveAudioFile(wavBuffer: Buffer, chunkIndex: number, outputDir: string): Promise<string> {
    const fileName = `output_audio_${chunkIndex}.wav`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, wavBuffer);
    return filePath;
  }

  async processTextToSpeech(text: string, outputDir: string = 'D:\\Canais Dark'): Promise<string[]> {
    if (!text) {
      throw new Error('Nenhum texto foi fornecido.');
    }

    // Criar diretório de saída se não existir
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Diretório já existe
    }

    const chunks = this.splitTextIntoChunks(text);
    const savedFiles: string[] = [];

    console.log(`Processando ${chunks.length} chunks de texto...`);

    // Processamento em blocos de 5 chunks para melhor performance
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`\nProcessando bloco ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)...`);
      
      // Processar chunks do bloco em paralelo
      const batchPromises = batch.map(async (chunk) => {
        try {
          console.log(`Iniciando conversão do chunk ${chunk.chunkIndex + 1}/${chunks.length}...`);
          
          const rawAudio = await this.convertToSpeech(chunk);
          const wavAudio = this.convertToWav(rawAudio);
          const filePath = await this.saveAudioFile(wavAudio, chunk.chunkIndex, outputDir);
          
          console.log(`Chunk ${chunk.chunkIndex + 1} salvo: ${filePath}`);
          return filePath;
          
        } catch (error) {
          console.error(`Erro ao processar chunk ${chunk.chunkIndex + 1}:`, error.message);
          console.error('Continuando com próximo chunk...');
          return null;
        }
      });
      
      // Aguardar todos os chunks do bloco terminarem
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Adicionar apenas os resultados bem-sucedidos
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          savedFiles.push(result.value);
        }
      });
      
      // Delay entre blocos para evitar rate limiting
      if (i + batchSize < chunks.length) {
        console.log('Aguardando antes do próximo bloco...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Gerar prompts de imagem após conversão de áudio
    try {
      console.log('\n🎨 Gerando prompts de imagem...');
      const prompts = await this.generateImagePrompts(chunks, outputDir);
      
      // Gerar imagens com Whisk após prompts
      console.log('\n🖼️ Gerando imagens com Whisk...');
      await this.generateImagesWithWhisk(prompts, outputDir);

      // Renderizar vídeo final com FFmpeg
      console.log('\n🎬 Renderizando vídeo final...');
      await this.renderVideoWithFFmpeg(outputDir);
      
    } catch (error) {
      console.error('❌ Erro ao gerar prompts/imagens/vídeo:', error.message);
      console.log('Áudios foram gerados com sucesso, mas prompts/imagens/vídeo falharam.');
    }

    return savedFiles;
  }

  async generateImagePrompts(chunks: TextChunk[], outputDir: string): Promise<string[]> {
    const batchSize = 5;
    const allPrompts: string[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} para prompts de imagem...`);

      try {
        const prompts = await this.callChatGPT(batch);
        allPrompts.push(...prompts);
        console.log(`✅ Gerados ${prompts.length} prompts para o lote`);
      } catch (error) {
        console.error(`❌ Erro ao processar lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        // Adicionar prompts vazios para manter numeração
        for (let j = 0; j < batch.length; j++) {
          allPrompts.push(`[ERRO] Não foi possível gerar prompt para o chunk ${batch[j].chunkIndex + 1}`);
        }
      }

      // Delay entre lotes
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Salvar prompts em arquivo
    await this.saveImagePrompts(allPrompts, outputDir);
    
    return allPrompts;
  }

  async callChatGPT(chunks: TextChunk[]): Promise<string[]> {
    const chunksText = chunks.map((chunk, index) => 
      `=== CHUNK ${chunk.chunkIndex + 1} ===\n${chunk.text}\n`
    ).join('\n');

    const prompt = `Analise os seguintes trechos de texto e para cada um gere um prompt detalhado para geração de imagem foto realista que represente visualmente a cena principal descrita no trecho.

IMPORTANTE: 
1. Primeiro identifique o idioma predominante dos textos
2. Adapte os prompts para refletir a cultura e características visuais típicas desse país/região

EXEMPLOS DE CONTEXTUALIZAÇÃO POR PAÍS/IDIOMA:

- PORTUGUÊS BRASILEIRO: 
  • Lugares: favelas cariocas, bairros paulistanos, praias de Copacabana, centro histórico de Salvador, subúrbios de BH, interior de MG
  • Pessoas: diversidade étnica (pardos, negros, brancos, asiáticos), cabelos cacheados/crespos, pele morena, roupas casuais (bermuda, chinelo, camiseta)
  • Carros: Gol, Palio, Onix, HB20, Civic, táxis amarelos
  • Arquitetura: casas de alvenaria, prédios residenciais, quitinetes, sobrados, construção típica brasileira

- ESPANHOL:
  • Lugares: praças espanholas, ruas de Madrid/Barcelona, costa mediterrânea, pueblos andaluzes, centros históricos
  • Pessoas: pele mediterrânea, cabelos castanhos/pretos, características ibéricas, vestimentas elegantes casuais
  • Carros: SEAT León/Ibiza, Renault Clio, Volkswagen Polo, Opel Corsa
  • Arquitetura: casas andaluzas, prédios de apartamentos europeus, balcões de ferro, telhas de barro

- ITALIANO:
  • Lugares: piazzas italianas, ruas de Roma/Milão, costa italiana, centros históricos, vilarejos toscanos
  • Pessoas: características mediterrâneas, gestos expressivos, estilo italiano elegante, cabelos escuros
  • Carros: Fiat 500/Panda, Alfa Romeo Giulia, Lancia, Volkswagen Golf
  • Arquitetura: prédios históricos italianos, varandas com plantas, janelas com persianas, pedra e mármore

- INGLÊS (EUA):
  • Lugares: subúrbios americanos, downtown, shopping malls, highways, bairros residenciais, parques urbanos
  • Pessoas: diversidade étnica americana (brancos, negros, latinos, asiáticos), roupas casuais americanas (jeans, sneakers)
  • Carros: Ford F-150, Chevrolet Camaro/Silverado, Toyota Camry, Honda Accord, táxis amarelos NYC
  • Arquitetura: casas suburbanvas, prédios de vidro, arranha-céus, construção americana típica

- FRANCÊS:
  • Lugares: boulevards parisienses, cafés franceses, centros históricos, províncias francesas, vilarejos
  • Pessoas: elegância francesa, estilo chic, características francesas, roupas refinadas mas casuais
  • Carros: Peugeot 208/308, Citroën C3/C4, Renault Clio/Megane
  • Arquitetura: prédios haussmannianos, apartamentos franceses, janelas francesas, varandas de ferro

- POLONÊS:
  • Lugares: centros históricos poloneses, bairros residenciais do leste europeu, praças medievais, cidades pós-socialistas
  • Pessoas: características eslavas, cabelos loiros/castanhos, pele clara, roupas européias práticas
  • Carros: Škoda Octavia, Volkswagen Passat, Opel Astra, Fiat 500
  • Arquitetura: prédios socialistas, casas européias, blocos residenciais, centros históricos preservados

- ROMENO:
  • Lugares: centros históricos romenos, bairros de Bucareste, vilarejos rurais, paisagens balcânicas
  • Pessoas: características do leste europeu/balcânicas, cabelos castanhos/pretos, mistura étnica balcânica
  • Carros: Dacia Logan/Sandero, Renault, Volkswagen, Opel
  • Arquitetura: construção balcânica, prédios comunistas, casas rurais romenas, influência otomana

${chunksText}

Para cada chunk, retorne apenas o prompt de imagem, um por linha, numerado sequencialmente. 
O prompt deve ser em português, descritivo, focado na cena visual principal, incluindo detalhes sobre personagens, ambiente, ações e atmosfera.
Contextualize culturalmente: se um texto menciona "taxista", descreva um taxista brasileiro com carro popular brasileiro. Se menciona "casa", descreva arquitetura típica local.
Mantenha cada prompt em uma única linha.

Formato esperado:
1. [prompt culturalmente contextualizado para chunk 1]
2. [prompt culturalmente contextualizado para chunk 2]  
3. [prompt culturalmente contextualizado para chunk 3]
...`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em criar prompts para geração de imagens foto realistas com contextualização cultural precisa. Identifique o idioma do texto e adapte TODOS os elementos visuais para refletir a cultura específica: arquitetura típica do país, marcas de carros locais/populares, características físicas e étnicas regionais, paisagens urbanas/rurais características, roupas e objetos culturais. Seja específico com marcas e modelos de carros, estilos arquitetônicos e características visuais que tornem a imagem autenticamente representativa daquela cultura.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // Extrair prompts numerados
    const lines = content.split('\n').filter((line: string) => line.trim());
    const prompts = lines
      .filter((line: string) => /^\d+\.\s/.test(line.trim()))
      .map((line: string) => line.replace(/^\d+\.\s/, '').trim());

    return prompts;
  }

  async saveImagePrompts(prompts: string[], outputDir: string): Promise<void> {
    const fileName = 'prompts_de_imagem.txt';
    const filePath = path.join(outputDir, fileName);
    
    const content = prompts.map((prompt, index) => 
      `=== PROMPT ${index + 1} ===\n${prompt}\n=== IMAGEM CORRESPONDENTE: imagem_${index + 1}.jpg ===\n`
    ).join('\n');

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`📝 Prompts de imagem salvos em: ${filePath}`);
  }

  async generateImagesWithWhisk(prompts: string[], outputDir: string): Promise<void> {
    if (prompts.length === 0) {
      console.log('❌ Nenhum prompt disponível para gerar imagens');
      return;
    }

    console.log(`🖼️ Gerando ${prompts.length} imagem(ns) com Whisk...`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      if (prompt.startsWith('[ERRO]')) {
        console.log(`⏭️ Pulando prompt ${i + 1} (erro)`);
        continue;
      }

      try {
        console.log(`🎨 Gerando imagem ${i + 1}/${prompts.length}...`);
        const imageBuffer = await this.callWhiskAPI(prompt);
        await this.saveImage(imageBuffer, i, outputDir);
        console.log(`✅ Imagem ${i + 1} salva com sucesso`);

        // Delay entre imagens para evitar rate limiting
        if (i < prompts.length - 1) {
          console.log(`⏳ Aguardando 3s antes da próxima imagem...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        console.error(`❌ Erro ao gerar imagem ${i + 1} após todas as tentativas:`, error.message);
        console.log('Continuando com próxima imagem...');
      }
    }
  }

  async callWhiskAPI(prompt: string): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries} para gerar imagem...`);
          // Delay progressivo entre tentativas
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const payload = {
          clientContext: {
            workflowId: this.generateUUID(),
            tool: "BACKBONE",
            sessionId: `;${Date.now()}`
          },
          imageModelSettings: {
            imageModel: "IMAGEN_3_5",
            aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE"
          },
          seed: Math.floor(Math.random() * 1000000),
          prompt: prompt,
          mediaCategory: "MEDIA_CATEGORY_BOARD"
        };

        const response = await axios.post('https://aisandbox-pa.googleapis.com/v1/whisk:generateImage', payload, {
          headers: {
            'accept': '*/*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,it;q=0.6',
            'authorization': `Bearer ${this.whiskToken}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://labs.google',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://labs.google/',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-browser-channel': 'stable',
            'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
            'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
            'x-browser-year': '2025',
            'x-client-data': 'CKW1yQEIjbbJAQiktskBCKmdygEI34DLAQiTocsBCKSjywEIhaDNAQjh8M4BCKXyzgE='
          }
        });

        // Extrair a imagem base64 da resposta
        const responseData = response.data;
        
        if (!responseData || !responseData.imagePanels || !responseData.imagePanels[0] || 
            !responseData.imagePanels[0].generatedImages || !responseData.imagePanels[0].generatedImages[0] ||
            !responseData.imagePanels[0].generatedImages[0].encodedImage) {
          throw new Error(`Resposta inválida do Whisk: ${JSON.stringify(responseData)}`);
        }

        // Decodificar base64 para buffer
        const base64Image = responseData.imagePanels[0].generatedImages[0].encodedImage;
        
        if (attempt > 0) {
          console.log(`✅ Imagem gerada com sucesso na tentativa ${attempt + 1}!`);
        }
        
        return Buffer.from(base64Image, 'base64');

      } catch (error) {
        lastError = error;
        const isUnauthorized = error.response?.status === 401;
        const isRateLimit = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        
        console.error(`❌ Tentativa ${attempt + 1}/${maxRetries} falhou:`, error.message);
        
        if (isUnauthorized) {
          console.log(`🔑 Erro de autenticação detectado (401)`);
          
          if (this.consoleService && typeof this.consoleService.promptForNewToken === 'function') {
            try {
              const newToken = await this.consoleService.promptForNewToken();
              if (newToken && newToken.length > 10) {
                this.updateWhiskToken(newToken);
                console.log(`🔄 Tentando novamente com o novo token...`);
                continue; // Tentar novamente com novo token
              } else {
                console.log(`❌ Token inválido fornecido`);
                break;
              }
            } catch (tokenError) {
              console.error(`❌ Erro ao obter novo token:`, tokenError.message);
              break;
            }
          } else {
            console.log(`❌ Console service não disponível para solicitar novo token`);
            break;
          }
        } else if (isRateLimit || isServerError) {
          console.log(`🔄 Erro de rate limit/servidor, tentando novamente...`);
          if (attempt < maxRetries - 1) {
            continue; // Tentar novamente
          }
        } else {
          // Erro que não é recuperável - não tentar novamente
          break;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para gerar imagem`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    throw lastError;
  }

  async saveImage(imageBuffer: Buffer, imageIndex: number, outputDir: string): Promise<void> {
    const fileName = `imagem_${imageIndex + 1}.jpg`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, imageBuffer);
    console.log(`🖼️ Imagem ${imageIndex + 1} salva: ${fileName}`);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async renderVideoWithFFmpeg(outputDir: string): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      // Verificar se FFmpeg está instalado
      try {
        await execAsync('ffmpeg -version');
      } catch (error) {
        throw new Error(`FFmpeg não encontrado. Por favor, instale o FFmpeg:
        
📥 INSTALAÇÃO DO FFMPEG:
Windows: 
1. Baixe de: https://ffmpeg.org/download.html#build-windows
2. Extraia e adicione ao PATH do sistema
3. Ou use: winget install FFmpeg

Linux/Mac:
- Ubuntu/Debian: sudo apt install ffmpeg
- CentOS/RHEL: sudo yum install ffmpeg
- macOS: brew install ffmpeg

❗ Após a instalação, reinicie o terminal e tente novamente.`);
      }

      console.log('🎬 Iniciando renderização do vídeo com FFmpeg...');

      // Verificar se os arquivos de áudio e imagem existem
      const audioFiles = await this.getAudioFiles(outputDir);
      const imageFiles = await this.getImageFiles(outputDir);

      if (audioFiles.length === 0) {
        throw new Error('Nenhum arquivo de áudio encontrado para renderização');
      }

      if (imageFiles.length === 0) {
        throw new Error('Nenhuma imagem encontrada para renderização');
      }

      console.log(`📊 Encontrados ${audioFiles.length} áudios e ${imageFiles.length} imagens`);

      // Criar lista de inputs para FFmpeg
      const videoSegments: string[] = [];
      const minLength = Math.min(audioFiles.length, imageFiles.length);

      for (let i = 0; i < minLength; i++) {
        const audioFile = audioFiles[i];
        const imageFile = imageFiles[i];
        const segmentOutput = path.join(outputDir, `segment_${i + 1}.mp4`);

        console.log(`🎥 Criando segmento ${i + 1}/${minLength}...`);

        // Comando FFmpeg para cada segmento
        const ffmpegCommand = `ffmpeg -y -loop 1 -i "${imageFile}" -i "${audioFile}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" -shortest "${segmentOutput}"`;
        
        await execAsync(ffmpegCommand);
        videoSegments.push(segmentOutput);
        console.log(`✅ Segmento ${i + 1} criado: ${path.basename(segmentOutput)}`);
      }

      // Criar arquivo de lista para concatenação
      const listFile = path.join(outputDir, 'segments_list.txt');
      const listContent = videoSegments.map(segment => `file '${segment}'`).join('\n');
      await fs.writeFile(listFile, listContent, 'utf-8');

      // Concatenar todos os segmentos
      const finalOutput = path.join(outputDir, 'video_final.mp4');
      const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${finalOutput}"`;
      
      console.log('🔗 Concatenando segmentos...');
      await execAsync(concatCommand);

      // Limpar arquivos temporários
      console.log('🧹 Limpando arquivos temporários...');
      for (const segment of videoSegments) {
        try {
          await fs.unlink(segment);
        } catch (error) {
          console.warn(`Aviso: Não foi possível deletar ${segment}`);
        }
      }
      
      try {
        await fs.unlink(listFile);
      } catch (error) {
        console.warn('Aviso: Não foi possível deletar o arquivo de lista');
      }

      console.log(`🎉 Vídeo renderizado com sucesso: ${finalOutput}`);
      return finalOutput;

    } catch (error) {
      console.error('❌ Erro durante a renderização:', error.message);
      throw error;
    }
  }

  private async getAudioFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const audioFiles = files
        .filter(file => file.startsWith('output_audio_') && file.endsWith('.wav'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/output_audio_(\d+)\.wav/)?.[1] || '0');
          const bNum = parseInt(b.match(/output_audio_(\d+)\.wav/)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return audioFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de áudio:', error);
      return [];
    }
  }

  private async getImageFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const imageFiles = files
        .filter(file => file.startsWith('imagem_') && file.endsWith('.jpg'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/imagem_(\d+)\.jpg/)?.[1] || '0');
          const bNum = parseInt(b.match(/imagem_(\d+)\.jpg/)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return imageFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de imagem:', error);
      return [];
    }
  }

  async renderExistingFiles(outputDir: string): Promise<string> {
    console.log(`\n🎬 Renderizando vídeo a partir dos arquivos existentes em: ${outputDir}`);
    return await this.renderVideoWithFFmpeg(outputDir);
  }
}