export interface WhiskAuthOptions {
  email?: string;
  password?: string;
  headless?: boolean;
  timeout?: number;
}

export interface WhiskTokenInfo {
  token: string;
  extractedAt: Date;
  method: 'headers' | 'storage' | 'response' | 'manual';
}
