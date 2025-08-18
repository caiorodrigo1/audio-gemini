# 🤖 Automação do Token Whisk

Este documento explica como usar a nova funcionalidade de automação para extrair o token do Whisk automaticamente.

## 🎯 Problema Resolvido

Antes você precisava:
1. 🔍 Abrir o browser manualmente
2. 🌐 Navegar para o Whisk
3. 🔧 Abrir ferramentas de desenvolvedor
4. 📋 Encontrar e copiar o token manualmente
5. ✏️ Colar no arquivo `.env`

Agora o processo é **100% automático**! 🚀

## 🚀 Como Usar

### Opção 1: Extração Manual (Recomendado para primeira vez)

```bash
npm run extract-token
```

**O que acontece:**
- ✅ Abre o browser automaticamente
- ✅ Navega para o Whisk
- ✅ Aguarda você fazer login (se necessário)
- ✅ Extrai o token automaticamente
- ✅ Salva no arquivo `.env`
- ✅ Mantém cookies para próximas execuções

### Opção 2: Modo Headless (Rápido)

```bash
npm run extract-token-headless
```

**Quando usar:**
- ✅ Quando você já fez login antes
- ✅ Para automação em scripts
- ✅ Quando os cookies estão salvos

### Opção 3: Com Credenciais (Experimental)

```bash
npm run extract-token-with-creds --email=seu_email@gmail.com --password=sua_senha
```

**⚠️ Aviso**: Funciona mas pode falhar devido à autenticação 2FA do Google.

## 🔄 Automação Integrada

A melhor parte: **o sistema renova automaticamente quando detecta erro de token**! Muito mais eficiente! 🚀

### Como Funciona (Abordagem Otimizada)

1. **Tentativa Normal**: Faz a requisição normalmente para o Whisk
2. **Detecção de Erro**: Se receber erro 401/403 (token inválido):
   - 🤖 Automaticamente abre o browser
   - 🔑 Extrai novo token
   - 💾 Atualiza o `.env`
   - 🔄 Refaz a requisição com token novo
3. **Fallback Manual**: Se automação falhar, solicita token manualmente

### Configuração no Código

```typescript
// Abordagem otimizada - só renova quando necessário:
try {
  const imageBuffer = await this.callWhiskAPI(prompt);
} catch (error) {
  if (error.status === 401 || error.status === 403) {
    await this.renewTokenAutomatically(); // ← Só executa quando há erro
    const imageBuffer = await this.callWhiskAPI(prompt); // ← Retry automático
  }
}
```

### 🚀 Vantagens da Nova Abordagem

- ⚡ **Sem latência desnecessária**: Não verifica token antes de cada requisição
- 🎯 **Renovação sob demanda**: Só renova quando realmente precisa
- 🔄 **Retry automático**: Continua o processamento sem interrupção
- 🛡️ **Fallback robusto**: Se automação falhar, ainda tem método manual

## 📁 Arquivos Criados

### `src/services/whisk-auth.service.ts`
Serviço principal com todas as funcionalidades:
- `extractWhiskToken()` - Extração automática
- `updateTokenInEnv()` - Atualização do .env
- `checkIfLoggedIn()` - Verificação de login
- `extractTokenFromStorage()` - Busca no localStorage/sessionStorage

### `src/extract-token.ts`
Script de linha de comando para extrair token manualmente

### `whisk-cookies.json`
Arquivo gerado automaticamente para salvar cookies e evitar login repetido

## 🛠️ Configuração Avançada

### Modo Debug
Para ver o que está acontecendo:

```bash
# Executa sem headless (mostra o browser)
npm run extract-token
```

### Personalizar Timeout
No código, você pode ajustar:

```typescript
const token = await whiskAuthService.extractWhiskToken(
  email,
  password,
  false, // headless
  30000  // timeout em ms
);
```

## 🔧 Solução de Problemas

### Token não foi encontrado
```bash
❌ Não foi possível extrair o token automaticamente
```

**Soluções:**
1. Execute sem `--headless` para ver o que está acontecendo
2. Certifique-se de estar logado no Google/Whisk
3. Verifique sua conexão com internet
4. Delete `whisk-cookies.json` e tente novamente

### Login falhou
```bash
⚠️ Login automático falhou
```

**Soluções:**
1. Use o modo visual: `npm run extract-token`
2. Faça login manualmente quando o browser abrir
3. O sistema detectará automaticamente quando você estiver logado

### Browser não abre
```bash
❌ Erro ao iniciar browser
```

**Soluções:**
1. Instale Chrome/Chromium: `winget install Google.Chrome`
2. Ou use: `npm install puppeteer` para baixar Chromium automaticamente

## 📊 Status e Monitoramento

O sistema fornece logs detalhados:

```bash
🤖 Iniciando automação para extrair token do Whisk...
📋 Modo: Visual (recomendado para primeira vez)
🌐 Navegando para o Whisk...
🔑 Fazendo login...
🔍 Procurando por requisições com token...
🎯 Token encontrado no Authorization header!
✅ Token extraído e salvo no .env
🚀 Agora você pode executar o projeto normalmente
```

## 🔒 Segurança

- ✅ **Cookies locais**: Salvos apenas no seu computador
- ✅ **Sem armazenamento**: Credenciais não são salvas
- ✅ **Token temporário**: Renovado automaticamente quando expira
- ✅ **Sem rede**: Funciona offline após primeira configuração

## 🚀 Benefícios

### Antes
- ⏱️ 5-10 minutos para extrair token manualmente
- 🔄 Toda vez que expira, processo manual
- 😤 Frustrante e repetitivo
- 🐌 Verificação desnecessária antes de cada requisição

### Depois
- ⚡ 0 segundos quando token válido (sem verificação prévia)
- 🎯 10-30 segundos renovação só quando necessário
- 🤖 Renovação automática sob demanda
- 😍 Experiência fluida e transparente
- 🚀 Performance otimizada - máxima eficiência

---

**🎉 Resultado**: Você nunca mais precisa se preocupar com token Whisk expirado!
