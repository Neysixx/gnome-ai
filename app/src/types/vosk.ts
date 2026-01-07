export interface VoskPartialResult {
  partial: string;
}

export interface VoskResult {
  text: string;
}

export interface VoskWebSocketOptions {
  serverUrl?: string;
  onResult?: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onError?: (error: string) => void;
}
