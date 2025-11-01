# Modo Fish Audio - Fluxo Alternativo de TTS

Este projeto agora suporta o **Fish Audio** como uma alternativa ao Google Gemini TTS para economizar suas API keys limitadas.

## 🐟 Como Usar o Fish Audio

### 1. Configuração Inicial

Primeiro, você precisa configurar as credenciais do Fish Audio no arquivo `.env`:

```bash
# Descomente e configure estas linhas no .env:
FISH_AUDIO_API_KEY=sua_api_key_do_fish_audio
FISH_AUDIO_REFERENCE_ID=seu_reference_id_do_modelo
```

### 2. Obter API Key e Reference IDs das Vozes

1. **Crie uma conta:** Vá para [https://fish.audio/](https://fish.audio/)
2. **Obtenha a API Key:** Acesse sua conta e gere uma API key
3. **Configure vozes por idioma:** Para cada idioma que você vai usar, crie/selecione um modelo de voz e anote o reference ID

#### Vozes Suportadas:
- **🇪🇸 Espanhol (ES)** - Para conteúdo Wild West e Velho Oeste ✅ Configurado
- **🇩🇪 Alemão (DE)** - Para conteúdo alemão ✅ Configurado  
- **🇧🇷 Português (PT-BR)** - Para conteúdo brasileiro ✅ Configurado
- **🇺🇸 Inglês (EN-US)** - Para conteúdo americano
- **🇮🇹 Italiano (IT)** - Para conteúdo italiano
- **🇵🇱 Polonês (PL)** - Para conteúdo polonês
- **🇷🇴 Romeno (RO)** - Para conteúdo romeno

### 3. Configurar Reference IDs das Vozes

Edite o arquivo `src/config/voices.config.ts` e substitua os placeholders pelos seus Reference IDs:

```typescript
{
  id: 'spanish_male',
  name: 'Espanhol Masculino',
  language: 'ES',
  description: 'Voz masculina espanhola - ideal para conteúdo em espanhol',
  referenceId: '3f45a7fd7a614655a61eb7027b955783' // ✅ Já configurado
},
{
  id: 'german_male',
  name: 'Alemão Masculino',
  language: 'DE',
  description: 'Voz masculina alemã - ideal para conteúdo em alemão',
  referenceId: '90042f762dbf49baa2e7776d011eee6b' // ✅ Já configurado
},
{
  id: 'portuguese_male',
  name: 'Português Masculino',
  language: 'PT-BR', 
  description: 'Voz masculina brasileira - ideal para conteúdo em português',
  referenceId: 'a35003f7cc784a989bf2d54db0d93f8f' // ✅ Já configurado
},
// ... outras vozes
```

### 4. Executar com Fish Audio

Você tem duas opções para usar o Fish Audio:

```bash
# Opção 1: Usar o script npm
npm run start:fish

# Opção 2: Usar o comando direto
npm start -- --fish-audio
```

### 5. Seleção Interativa de Voz

Quando você executar com Fish Audio, o sistema mostrará um menu de seleção:

```bash
🎙️ ===== SELEÇÃO DE VOZ FISH AUDIO =====
Vozes disponíveis:

1. ✅ Espanhol Masculino (ES)
   Voz masculina espanhola - ideal para conteúdo em espanhol

2. ✅ Alemão Masculino (DE)
   Voz masculina alemã - ideal para conteúdo em alemão

3. ✅ Português Masculino (PT-BR)
   Voz masculina brasileira - ideal para conteúdo em português

4. ❌ Inglês Masculino (EN-US)
   Voz masculina americana - ideal para conteúdo em inglês

💡 ✅ = Configurada e pronta para uso
💡 ❌ = Precisa configurar o Reference ID

Escolha uma voz (número) ou pressione Enter para usar a padrão:
```

### 6. Diferenças do Modo Fish Audio

Quando o modo Fish Audio está ativo:

- ✅ **Não usa Google API Keys** - Economiza suas keys limitadas
- ✅ **Não usa Whisk Token** - Não precisa do token do Google Labs
- ✅ **Áudio WAV direto** - Fish Audio já retorna em formato WAV
- ✅ **Ainda gera imagens** - Continua usando ChatGPT para prompts e Whisk para imagens
- ✅ **Renderização completa** - Gera o vídeo final normalmente

### 5. Vantagens do Fish Audio

- **Economiza API quotas** - Suas Google API Keys ficam intocadas
- **Qualidade profissional** - Fish Audio é SOTA (State of the Art) em TTS
- **Multilíngua** - Suporta português, inglês e outros idiomas
- **Voice cloning** - Pode clonar vozes específicas com reference ID
- **Controle de emoção** - Permite ajustar tom e emoção da voz

### 6. Solução de Problemas

#### Erro de configuração inválida:
```bash
❌ Configuração do Fish Audio inválida:
   • FISH_AUDIO_API_KEY não configurada no arquivo .env
   • FISH_AUDIO_REFERENCE_ID não configurada no arquivo .env
```

**Solução:** Configure as variáveis no arquivo `.env` conforme mostrado acima.

#### Erro de autenticação:
```bash
❌ Erro de autenticação - verifique sua API key do Fish Audio
```

**Solução:** Verifique se sua API key está correta e ativa.

### 7. Exemplo de Uso Completo

1. Configure o `.env`:
```bash
FISH_AUDIO_API_KEY=fa-abc123def456...
FISH_AUDIO_REFERENCE_ID=modelo-voz-masculina-br
```

2. Execute:
```bash
npm run start:fish
```

3. Use normalmente:
```bash
Digite o texto: "C:\meu-roteiro.txt"
```

O sistema irá:
- ✅ Gerar áudio com Fish Audio (não usa Google API Keys)
- ✅ Gerar imagens com Whisk (usa apenas o Whisk Token para imagens)  
- ✅ Renderizar vídeo completo

## 🔄 Alternar Entre Modos

- **Modo Google Gemini:** `npm start` (padrão)
- **Modo Fish Audio:** `npm run start:fish`

Ambos os modos geram exatamente o mesmo resultado final (vídeo completo), mas usam diferentes APIs para a geração de áudio.