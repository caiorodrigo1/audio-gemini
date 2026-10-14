import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Envia o resultado de um job para o `receive_url` informado pelo cliente.
 * Se WEBHOOK_SECRET estiver definido, assina o corpo com HMAC-SHA256
 * no header X-Signature (hex) para o receptor conferir a origem.
 */
@Injectable()
export class WebhookService {
  constructor(
    private readonly post: (url: string, body: string, headers: Record<string, string>) => Promise<unknown> =
      (url, body, headers) => axios.post(url, body, { headers, timeout: REQUEST_TIMEOUT_MS }),
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise(r => setTimeout(r, ms)),
  ) {}

  async notify(url: string, payload: unknown): Promise<boolean> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      headers['X-Signature'] = createHmac('sha256', secret).update(body).digest('hex');
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.post(url, body, headers);
        return true;
      } catch (err: any) {
        console.warn(`⚠️ Webhook para ${url} falhou (tentativa ${attempt}/${MAX_ATTEMPTS}): ${err?.message}`);
        if (attempt < MAX_ATTEMPTS) await this.wait(RETRY_DELAY_MS);
      }
    }
    return false;
  }
}
