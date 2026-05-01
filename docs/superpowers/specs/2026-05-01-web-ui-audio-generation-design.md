# Web UI para Geração de Áudio (Gemini)

**Data:** 2026-05-01
**Status:** Aprovado para planejamento

## Objetivo

Adicionar uma interface web local ao projeto `audio-gemini` que permita:

1. Colar um texto e gerar áudio via Google Gemini TTS.
2. Selecionar a voz a partir de uma lista agrupada por gênero (Masculinas / Femininas).
3. Acompanhar o progresso da geração com barra de progresso e contador de chunks.
4. Ouvir o áudio gerado direto no navegador e baixá-lo.

A UI **não substitui** o fluxo CLI atual — coexiste com ele.

## Escopo

**Inclui:**
- Servidor HTTP embutido no projeto NestJS existente.
- Página única estática (HTML + CSS + JS vanilla, sem build de frontend).
- Endpoint para iniciar uma geração e endpoint SSE para acompanhar progresso.
- Player de áudio + download na própria página.
- Lista fixa de vozes prebuilt do Gemini, agrupadas por gênero.

**Não inclui:**
- Upload de arquivo ou pasta.
- Suporte a Fish Audio na UI (CLI segue suportando).
- Persistência de jobs (estado fica em memória; reinício do servidor descarta jobs).
- Cancelamento de geração em andamento.
- Autenticação (uso local).
- Fila de múltiplos jobs simultâneos pelo mesmo usuário (um job por vez por sessão).

## Arquitetura

### Visão geral

```
[Browser]  ──  GET /                      ──>  index.html (estático)
           ──  GET /api/voices            ──>  lista de vozes agrupadas
           ──  POST /api/generate         ──>  { jobId }
           ──  GET /api/jobs/:id/events   ──>  SSE: progresso em tempo real
           ──  GET /api/jobs/:id/audio    ──>  binário do áudio final
```

### Componentes novos

1. **`WebModule`** (`src/web/web.module.ts`) — módulo NestJS que registra controller e serviço de jobs.
2. **`WebController`** (`src/web/web.controller.ts`) — expõe os endpoints HTTP.
3. **`JobService`** (`src/web/job.service.ts`) — gerencia estado dos jobs em memória.
4. **`gemini-voices.config.ts`** (`src/config/gemini-voices.config.ts`) — lista das vozes prebuilt agrupadas por gênero.
5. **`public/`** (na raiz do projeto) — `index.html`, `app.js`, `styles.css` servidos estaticamente.

### Componentes alterados

1. **`main.ts`** — passa a aceitar a flag `--web` (e script `npm run web`); quando ativada, sobe `NestFactory.create(AppModule)` em vez do `createApplicationContext`, escutando na porta 3000 (configurável via `PORT` env var). Modos CLI atuais (`npm start`, `start:fish`, `--audio-only`, etc.) permanecem inalterados.
2. **`TTSService`** — ganha um método novo `generateFromText(text, voiceName, onProgress)` que reusa toda a lógica existente de chunking/batches/retries, mas:
   - Aceita texto bruto em vez de ler arquivos.
   - Aceita `voiceName` dinâmico, sobrescrevendo `AUDIO_CONFIG.VOICE_NAME` apenas para aquele job (sem mutar o constant global).
   - Chama `onProgress({ processed, total, status })` a cada chunk concluído.
   - Retorna `Buffer` com áudio final concatenado (mesmo formato que o fluxo `--audio-only` produz hoje).
   - Não emite `console.log` próprio do CLI dentro deste fluxo (ou os silencia para não poluir o terminal do servidor web).
3. **`AppModule`** — importa `WebModule` quando o servidor sobe em modo web.

### Fluxo de uma geração

1. Usuário cola texto, escolhe voz, clica "Gerar áudio".
2. Frontend faz `POST /api/generate` com `{ text, voiceName }`.
3. `WebController` chama `JobService.create(text, voiceName)` que:
   - Gera um `jobId` (UUID).
   - Inicia `TTSService.generateFromText(...)` em background (Promise sem await imediato).
   - Registra job em `Map<jobId, JobState>`.
   - Retorna `{ jobId }` imediatamente.
4. Frontend abre `EventSource('/api/jobs/:jobId/events')`.
5. A cada chunk processado, `onProgress` empurra um evento na stream SSE: `{ processed, total, status: 'running' }`.
6. Quando o `Buffer` final estiver pronto, job é marcado como `done`; SSE emite `{ status: 'done' }` e fecha.
7. Frontend define `<audio src="/api/jobs/:jobId/audio">` e mostra botão de download.
8. Em caso de erro, SSE emite `{ status: 'error', message }` e fecha.

### `JobState` (em memória)

```ts
type JobStatus = 'pending' | 'running' | 'done' | 'error';

interface JobState {
  id: string;
  status: JobStatus;
  processed: number;
  total: number;
  audio?: Buffer;          // preenchido quando status === 'done'
  errorMessage?: string;   // preenchido quando status === 'error'
  subscribers: Array<(event: ProgressEvent) => void>;
  createdAt: Date;
}
```

Jobs antigos (`done` ou `error`) são removidos do mapa após N minutos (ex.: 30 min) para evitar acúmulo de buffers em memória — limpeza simples via `setInterval`.

## Lista de vozes (Gemini)

Arquivo `src/config/gemini-voices.config.ts`:

```ts
export interface GeminiVoice {
  id: string;          // valor enviado para a API (voice_name)
  name: string;        // nome exibido
  gender: 'male' | 'female';
  description: string; // descrição curta em português
}

export const GEMINI_VOICES: GeminiVoice[] = [
  // Masculinas
  { id: 'Charon',  name: 'Charon',  gender: 'male',   description: 'Voz masculina grave e informativa' },
  { id: 'Fenrir',  name: 'Fenrir',  gender: 'male',   description: 'Voz masculina firme e expressiva' },
  { id: 'Orus',    name: 'Orus',    gender: 'male',   description: 'Voz masculina clara e neutra' },
  { id: 'Puck',    name: 'Puck',    gender: 'male',   description: 'Voz masculina jovem e dinâmica' },
  // Femininas
  { id: 'Aoede',   name: 'Aoede',   gender: 'female', description: 'Voz feminina suave e melódica' },
  { id: 'Kore',    name: 'Kore',    gender: 'female', description: 'Voz feminina clara e neutra' },
  { id: 'Leda',    name: 'Leda',    gender: 'female', description: 'Voz feminina calma e narrativa' },
  { id: 'Zephyr',  name: 'Zephyr',  gender: 'female', description: 'Voz feminina leve e expressiva' },
];

export const DEFAULT_GEMINI_VOICE_ID = 'Charon';
```

`GET /api/voices` retorna:

```json
{
  "male":   [{ "id": "Charon",  "name": "Charon",  "description": "..." }, ...],
  "female": [{ "id": "Aoede",   "name": "Aoede",   "description": "..." }, ...],
  "default": "Charon"
}
```

## Endpoints

### `GET /`
Serve `public/index.html`.

### `GET /api/voices`
Retorna o JSON acima.

### `POST /api/generate`
**Body:** `{ text: string, voiceName: string }`
**Validação:**
- `text`: obrigatório, não-vazio, tamanho máximo configurável (ex.: 50.000 chars; rejeita acima disso com 400).
- `voiceName`: obrigatório, deve estar em `GEMINI_VOICES.map(v => v.id)` (rejeita com 400 se inválido).

**Resposta:** `200 { jobId: string }`.

### `GET /api/jobs/:id/events`  (SSE)
Headers: `Content-Type: text/event-stream`.
Eventos emitidos:
- `{ status: 'running', processed, total }` — a cada chunk concluído.
- `{ status: 'done' }` — fim, conexão fecha.
- `{ status: 'error', message }` — erro, conexão fecha.

Se `:id` não existe, retorna 404. Se job já terminou antes do cliente conectar, emite o evento final imediatamente e fecha.

### `GET /api/jobs/:id/audio`
- 404 se job não existe ou ainda não terminou.
- 200 com `Content-Type` apropriado (mesmo MIME que o fluxo atual produz — confirmar na implementação) e o `Buffer`.

## UI (página única)

Layout vertical, dark mode por padrão, CSS escrito à mão (~100 linhas).

**Seções:**

1. **Cabeçalho** — título "Audio Gemini" + descrição curta de uma linha.

2. **Card "Gerar"** (sempre visível):
   - Dropdown de voz: `<select>` com `<optgroup label="Masculinas">` e `<optgroup label="Femininas">`. Default: Charon.
   - Textarea grande, auto-resize, contador de caracteres no canto inferior direito.
   - Botão "Gerar áudio" — desabilitado se textarea vazia ou se há job em andamento.

3. **Card "Progresso"** (aparece só durante geração):
   - Texto de status: ex. "Processando chunk 7 de 15..."
   - `<progress max="100" value="...">` com percentual ao lado.

4. **Card "Resultado"** (aparece quando termina):
   - `<audio controls src="/api/jobs/:id/audio">`.
   - Botão "Download".
   - Botão "Nova geração" → reseta UI ao estado inicial.

5. **Estado de erro**:
   - Card vermelho com mensagem do servidor e botão "Tentar de novo" (volta ao estado inicial preservando texto e voz).

**JS:**
- Carrega `/api/voices` no load e popula o dropdown.
- Submit chama `POST /api/generate`, abre `EventSource` com o `jobId` retornado.
- A cada evento atualiza barra/texto. No `done`, troca card de progresso pelo de resultado.

## Tratamento de erros

- **Validação de input** (texto vazio, voz inválida): 400 com mensagem clara, exibida no card de erro.
- **Erro na geração** (falha de API, todas as keys exauridas, etc.): job marcado como `error` com mensagem; SSE emite e fecha; UI mostra card de erro.
- **Job não encontrado**: 404.
- **Servidor reinicia durante job**: cliente recebe erro de conexão SSE; UI mostra "Conexão perdida — recarregue a página".

## Configuração

Variáveis de ambiente novas (opcionais):
- `WEB_PORT` — porta do servidor web (padrão: 3000).
- `WEB_MAX_TEXT_LENGTH` — tamanho máximo do texto (padrão: 50000).

Script novo no `package.json`:
- `"web": "ts-node src/main.ts --web"`

## Testes

- **Manual end-to-end:** subir o servidor, abrir o browser, gerar um áudio curto, verificar player + download.
- **Unidade:** `JobService` (criação, atualização de progresso, limpeza de jobs antigos), validação do `WebController` (texto vazio, voz inválida).
- **Integração:** `TTSService.generateFromText` com texto pequeno mockando a chamada à API do Gemini, verificando que `onProgress` é invocado e o `Buffer` final retorna.

Não é necessário testar a parte do frontend automaticamente — validação manual no browser é suficiente dado o escopo.

## Riscos e pontos de atenção

1. **Reuso do `TTSService`**: o serviço atual está fortemente acoplado a I/O de arquivos e `console.log`. Refatorar pra extrair um método programático sem quebrar o fluxo CLI é o ponto mais delicado da implementação. A estratégia é **adicionar** um método novo que reusa as funções de baixo nível (chunking, chamadas à API, concatenação) sem tocar nos pontos de entrada existentes.
2. **Formato do áudio final**: confirmar na implementação se o `Buffer` final é WAV, MP3 ou outro — definir `Content-Type` correto no endpoint de download.
3. **Memória**: buffers de áudio podem ser grandes. Limpeza automática de jobs antigos é importante.
4. **`AUDIO_CONFIG.VOICE_NAME` global**: passar voz como parâmetro do método novo em vez de mutar o constant evita race condition entre jobs concorrentes (mesmo que a UI permita só um por vez, mantém o código limpo).
