export interface WhiskGeneratedImage {
  encodedImage: string;
}

export interface WhiskImagePanel {
  generatedImages: WhiskGeneratedImage[];
}

export interface WhiskApiResponse {
  imagePanels: WhiskImagePanel[];
}

export interface WhiskApiPayload {
  clientContext: {
    workflowId: string;
    tool: string;
    sessionId: string;
  };
  imageModelSettings: {
    imageModel: string;
    aspectRatio: string;
  };
  seed: number;
  prompt: string;
  mediaCategory: string;
}