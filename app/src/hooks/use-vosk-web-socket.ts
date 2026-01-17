import type { VoskPartialResult, VoskResult, VoskWebSocketOptions } from '@/types/vosk';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseVoskWebSocketReturn {
  startRecognition: () => Promise<void>;
  stopRecognition: () => void;
  isListening: boolean;
  isConnecting: boolean;
  serverStatus: boolean | null;
  error: string | null;
}

export function useVoskWebSocket(options: VoskWebSocketOptions = {}): UseVoskWebSocketReturn {
  const { config, onResult, onPartialResult, onError } = options;

  if (!config) {
    throw new Error('Config is required');
  }

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<boolean | null>(null);

  const getConfigServerUrl = useCallback(() => {
    const language = config?.llm?.language || 'auto';
    const port = language === 'en' ? 2701 : 2700;
    return `ws://localhost:${port}`;
  }, [config]);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.onopen = null;

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsListening(false);
    setIsConnecting(false);
  }, []);

  const pingServer = useCallback(() => {
    const url = getConfigServerUrl();
    const ws = new WebSocket(url);
    ws.onopen = () => {
      setServerStatus(true);
      ws.close();
    };
    ws.onerror = () => {
      setServerStatus(false);
    };
    ws.onclose = () => {};
  }, [getConfigServerUrl]);

  const startRecognition = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const ws = new WebSocket(getConfigServerUrl());
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('Connected to Vosk server');

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = stream;

          const audioContext = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          sourceRef.current = source;

          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              const audioData = event.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                const sample = Math.max(-1, Math.min(1, audioData[i]));
                pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767;
              }
              ws.send(pcmData.buffer);
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);

          setIsListening(true);
          setIsConnecting(false);
        } catch (err: unknown) {
          const errorMsg =
            (err as Error).name === 'NotAllowedError'
              ? 'Microphone access denied. Allow access in settings.'
              : `Microphone error: ${(err as Error).message}`;

          setError(errorMsg);
          onError?.(errorMsg);
          ws.close();
          setIsConnecting(false);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if ('partial' in data) {
            const result = data as VoskPartialResult;
            if (result.partial) {
              onPartialResult?.(result.partial);
            }
          }

          if ('text' in data) {
            const result = data as VoskResult;
            if (result.text) {
              onResult?.(result.text);
            }
          }
        } catch (err) {
          console.error('Error parsing Vosk message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        const errorMsg = 'Connection error to Vosk server';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsConnecting(false);
        cleanup();
      };

      ws.onclose = () => {
        console.log('Disconnected from Vosk server');
        cleanup();
      };
    } catch (err: unknown) {
      const errorMsg = `Error: ${(err as Error).message}`;
      setError(errorMsg);
      onError?.(errorMsg);
      setIsConnecting(false);
      cleanup();
    }
  }, [getConfigServerUrl, onResult, onPartialResult, onError, cleanup]);

  const stopRecognition = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ eof: 1 }));

      setTimeout(() => {
        cleanup();
      }, 200);
    } else {
      cleanup();
    }
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    pingServer();
  }, [pingServer]);

  return {
    startRecognition,
    stopRecognition,
    isListening,
    isConnecting,
    serverStatus,
    error,
  };
}
