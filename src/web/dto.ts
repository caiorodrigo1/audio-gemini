export interface GenerateRequestBody {
  text?: unknown;
  voiceName?: unknown;
}

export interface GenerateResponse {
  jobId: string;
}

export interface VoicesResponse {
  male: Array<{ id: string; name: string; description: string }>;
  female: Array<{ id: string; name: string; description: string }>;
  default: string;
}
