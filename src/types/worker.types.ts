export interface WorkerMessageData {
  imageDataUrl: string;
  format: "jpeg" | "png";
  targetSizeKB: number;
  maxWidth: number;
  maxHeight: number;
}

export interface WorkerResponseData {
  resizedImage: string;
  fileSize: number;
  progress?: number;
}

export type WorkerMessage = MessageEvent<WorkerMessageData>;
export type WorkerResponse = MessageEvent<WorkerResponseData>;
