import type { AppConfig } from './config';

export interface VoskPartialResult {
  partial: string;
}

export interface VoskResult {
  text: string;
}

export interface VoskWebSocketOptions {
  config?: AppConfig;
  serverUrl?: string;
  onResult?: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onError?: (error: string) => void;
}
