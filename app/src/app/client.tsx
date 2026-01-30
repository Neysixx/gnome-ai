'use client';

import { SettingsDialog } from '@/components/settings-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { ModeToggle } from '@/components/ui/theme-toggle';
import { useVoskWebSocket } from '@/hooks/use-vosk-web-socket';
import { QUERY_KEYS } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { AppConfig } from '@/types/config';
import { useChat } from '@ai-sdk/react';
import { useQuery } from '@tanstack/react-query';
import {
  DefaultChatTransport,
  type UIMessage,
  type UIMessagePart,
  getToolName,
  isToolUIPart,
} from 'ai';
import { Loader2, Mic, MicOff, Send, Sparkles, Trash, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper to extract text from a message
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<UIMessagePart<never, never>, { type: 'text' }> =>
        part.type === 'text',
    )
    .map((part) => part.text)
    .join('');
}

// Helper to extract tool parts from a message
function getToolParts(message: UIMessage) {
  return message.parts.filter(isToolUIPart);
}

// Helper to get the state of a tool call
function getToolState(part: ReturnType<typeof getToolParts>[number]): string {
  if ('state' in part) {
    return part.state;
  }
  return 'unknown';
}

export default function Client({ initialConfig }: { initialConfig: AppConfig }) {
  const [input, setInput] = useState('');
  const [uiError, setUiError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: [QUERY_KEYS.CONFIG],
    queryFn: async () => {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json() as Promise<AppConfig>;
    },
    initialData: initialConfig,
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'streaming' || status === 'submitted';

  const {
    startRecognition: startVoskRecognition,
    stopRecognition: stopVoskRecognition,
    isListening: isVoskListening,
    serverStatus: voskServerStatus,
  } = useVoskWebSocket({
    config: config,
    onResult: (text) => {
      setInput((prev) => {
        const newText = prev ? `${prev} ${text}` : text;
        return newText.trim();
      });
    },
    onPartialResult: (text) => {
      console.log('Transcription in progress:', text);
    },
    onError: (error) => {
      setUiError(error);
    },
  });

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('gnome-ai-history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load chat history', e);
      }
    }
  }, [setMessages]);

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('gnome-ai-history', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const startListening = async () => {
    if (typeof window === 'undefined') return;
    await startVoskRecognition();
  };

  const stopListening = () => {
    stopVoskRecognition();
  };

  const toggleVoiceInput = () => {
    if (isVoskListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }],
    });
    setInput('');
    setUiError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem('gnome-ai-history');
    setUiError(null);
  };

  return (
    <div className="flex h-screen flex-col bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-primary/20 to-secondary/20 text-primary ring-1 ring-primary/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            AI Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SettingsDialog config={config} />
          <ModeToggle />
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:px-6">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary ring-1 ring-primary/20">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mb-3 text-3xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="max-w-md text-muted-foreground/80 text-lg">
                I'm your AI assistant capable of using tools like Google Calendar or Todoist to help
                manage your tasks.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const text = getMessageText(message);
            const toolParts = getToolParts(message);
            const isUser = message.role === 'user';

            return (
              <div
                key={message.id}
                className={cn('flex w-full gap-4', isUser ? 'flex-row-reverse' : 'flex-row')}
              >
                <Avatar
                  className={cn(
                    'h-9 w-9 shrink-0 ring-1 ring-border/50',
                    isUser ? 'hidden' : 'block',
                  )}
                >
                  <AvatarFallback className={cn('bg-background text-primary')}>
                    <Sparkles className="h-4.5 w-4.5" />
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    'relative max-w-[85%] min-w-0 space-y-2',
                    isUser ? 'ml-auto' : 'mr-auto',
                  )}
                >
                  {/* Tool Calls */}
                  {toolParts.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {toolParts.map((toolPart) => {
                        const toolName = getToolName(toolPart);
                        const state = getToolState(toolPart);
                        const toolCallId =
                          'toolCallId' in toolPart ? toolPart.toolCallId : toolName;

                        return (
                          <div
                            key={toolCallId}
                            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span className="font-mono">{toolName}</span>
                            <div className="ml-auto flex items-center">
                              {state === 'result' && (
                                <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                                  Completed
                                </span>
                              )}
                              {state === 'call' && <Loader2 className="h-3 w-3 animate-spin" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Content */}
                  {text && (
                    <div
                      className={cn(
                        'prose prose-sm max-w-full wrap-break-word overflow-hidden rounded-2xl px-5 py-3.5',
                        isUser
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10 prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-a:text-primary-foreground prose-a:underline'
                          : 'bg-muted/50 text-foreground border border-border/40 shadow-sm prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80',
                      )}
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'underline underline-offset-2 transition-colors break-all',
                                isUser
                                  ? 'text-primary-foreground/90 hover:text-primary-foreground'
                                  : 'text-primary hover:text-primary/80',
                              )}
                            >
                              {children}
                            </a>
                          ),
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                          ),
                          code: ({ children }) => (
                            <code className="bg-foreground/5 rounded px-1.5 py-0.5 font-mono text-sm text-foreground/80 break-all">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="p-4 rounded-lg overflow-x-auto text-foreground my-2 max-w-full">
                              {children}
                            </pre>
                          ),
                          strong: ({ children }) => (
                            <strong className={cn('font-bold', !isUser && 'text-primary/80')}>
                              {children}
                            </strong>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-lg text-foreground font-bold mb-2">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-md text-foreground font-bold mb-2">{children}</h3>
                          ),
                          table: ({ children }) => (
                            <div className="my-4 w-full max-w-full overflow-x-auto">
                              <table className="w-full border-collapse border border-border/50 text-sm">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-muted/50 text-left">{children}</thead>
                          ),
                          tbody: ({ children }) => (
                            <tbody className="divide-y divide-border/50">{children}</tbody>
                          ),
                          tr: ({ children }) => (
                            <tr className="transition-colors hover:bg-muted/30">{children}</tr>
                          ),
                          th: ({ children }) => (
                            <th className="border-r border-border/50 px-4 py-2 font-semibold text-muted-foreground last:border-r-0">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border-r border-border/50 px-4 py-2 last:border-r-0">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {text}
                      </Markdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading/Typing Indicator */}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4">
              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                <AvatarFallback className="bg-background text-primary">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5 rounded-2xl border border-border/40 bg-muted/50 px-5 py-4 shadow-sm">
                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
              </div>
            </div>
          )}

          {/* Error */}
          {(error || uiError) && (
            <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-in slide-in-from-top-2">
              <span className="font-semibold">Error:</span> {uiError || error?.message}
            </div>
          )}

          {/* Anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Footer Input Area */}
      <div className="p-4 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center gap-2 rounded-2xl border border-input bg-background/50 p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl"
              onClick={handleClear}
              title="Clear History"
            >
              <Trash className="h-4 w-4" />
            </Button>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isVoskListening ? 'Listening...' : 'Message AI Assistant...'}
              className={cn(
                'min-h-[80px] max-h-[400px] flex-1 resize-y border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 text-base',
                isVoskListening && 'placeholder:text-primary animate-pulse',
              )}
              rows={3}
              disabled={isLoading}
            />

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant={isVoskListening ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-10 w-10 transition-all rounded-xl',
                  isVoskListening
                    ? 'bg-red-500 hover:bg-red-600 text-foreground animate-pulse'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
                onClick={toggleVoiceInput}
                title={isVoskListening ? 'Stop Listening' : 'Start Voice Recognition'}
                disabled={isLoading || voskServerStatus === false}
              >
                {voskServerStatus === null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isVoskListening ? (
                  <MicOff className="h-4 w-4 text-foreground" />
                ) : (
                  <Mic className="h-4 w-4 text-foreground" />
                )}
              </Button>

              <Button
                type="submit"
                size="icon"
                className={cn(
                  'h-10 w-10 shrink-0 transition-all rounded-xl shadow-sm',
                  !input.trim() || isLoading
                    ? 'opacity-50'
                    : 'opacity-100 hover:scale-105 active:scale-95',
                )}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
          <div className="mt-3 text-center text-xs text-muted-foreground/70">
            AI Assistant can make mistakes. Please double-check important information.
          </div>
        </div>
      </div>
    </div>
  );
}
