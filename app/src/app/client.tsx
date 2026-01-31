'use client';

import { SettingsDialog } from '@/components/settings-dialog';
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
import { Loader2, Mic, MicOff, Send, Trash, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentOrb } from '@/components/agent-orb';

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

  // Compute Agent State
  const agentState: 'idle' | 'thinking' | 'speaking' = useMemo(() => {
    if (isLoading) return 'thinking';
    // Potential future expansion for 'speaking' if TTS is added or streaming text is detected
    return 'idle';
  }, [isLoading]);

  return (
    <div className="flex h-screen flex-col bg-background font-sans selection:bg-primary/30">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Subtle monochrome ambient light */}
        <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] opacity-20 dark:opacity-40" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-background/60 px-6 py-4 backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          {/* Agent Orb Identity */}
          <div className="relative h-10 w-10">
            <AgentOrb state={agentState} className="h-10 w-10" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground transition-all duration-500">
            {agentState === 'thinking' ? 'AI Thinking...' : 'AI Assistant'}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 p-1 backdrop-blur-md">
          <SettingsDialog config={config} />
          <ModeToggle />
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="relative z-10 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="relative mb-8 h-32 w-32">
                <AgentOrb state="idle" className="h-32 w-32" />
              </div>
              <h2 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
                How can I help?
              </h2>
              <p className="max-w-md text-muted-foreground/80 text-lg">
                I'm ready to assist you with your tasks.
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
                <div
                  className={cn(
                    'h-10 w-10 shrink-0 transition-transform hover:scale-105',
                    isUser ? 'hidden' : 'block',
                  )}
                >
                  <AgentOrb state="idle" className="h-10 w-10" />
                </div>

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
                            className="group flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs font-medium text-muted-foreground transition-all hover:bg-white/10 hover:border-white/10"
                          >
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/50 ring-1 ring-white/10">
                              <Wrench className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-mono text-xs uppercase tracking-wider opacity-70">
                              {toolName}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              {state === 'result' && (
                                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                  Done
                                </span>
                              )}
                              {state === 'call' && (
                                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Running
                                </span>
                              )}
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
                        'prose prose-sm max-w-full overflow-hidden rounded-2xl px-6 py-4 shadow-sm backdrop-blur-md',
                        isUser
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-black/5'
                          : 'bg-card/40 border border-white/5 text-foreground shadow-black/5',
                        // Typography adjustments
                        'prose-headings:font-bold prose-headings:tracking-tight',
                        isUser
                          ? 'prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-a:text-primary-foreground focus-visible:ring-offset-2'
                          : 'prose-a:text-primary prose-a:no-underline prose-a:border-b prose-a:border-primary/30 hover:prose-a:border-primary prose-strong:text-foreground',
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
                              className="font-medium transition-all"
                            >
                              {children}
                            </a>
                          ),
                          p: ({ children }) => (
                            <p className="mb-3 last:mb-0 leading-7 opacity-90">{children}</p>
                          ),
                          code: ({ children }) => (
                            <code className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-xs font-medium",
                              isUser ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                            )}>
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="p-4 rounded-xl overflow-x-auto bg-black/40 border border-white/5 my-3 text-xs leading-loose text-white/90 shadow-inner">
                              {children}
                            </pre>
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

          {/* Reasoning / Loading State */}
          {/* Reasoning / Loading State */}
          {isLoading &&
            messages.length > 0 &&
            (messages[messages.length - 1]?.role === 'user' ||
              (messages[messages.length - 1]?.role === 'assistant' &&
                !getMessageText(messages[messages.length - 1]))) && (
              <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-10 w-10 shrink-0">
                  <AgentOrb state="thinking" className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-muted/50 px-5 py-4 backdrop-blur-sm">
                  <div className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-primary/50"></span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground animate-pulse">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

          {/* Anchor for auto-scroll */}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </ScrollArea>

      {/* Footer Input Area */}
      <div className="relative z-20 w-full p-4 md:p-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className={cn(
              "relative flex items-end gap-2 rounded-[1.5rem] border border-white/10 bg-background/60 p-2 shadow-2xl backdrop-blur-xl transition-all duration-300",
              "focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/30 focus-within:bg-background/80"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 mb-1 rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
              onClick={handleClear}
              title="Clear History"
            >
              <Trash className="h-5 w-5" />
            </Button>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isVoskListening ? 'Listening...' : 'Type a message...'}
              className={cn(
                'min-h-[50px] max-h-[200px] flex-1 resize-none border-0 bg-transparent px-2 py-3.5 shadow-none focus-visible:ring-0 text-base leading-relaxed',
                isVoskListening && 'placeholder:text-primary animate-pulse',
              )}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              disabled={isLoading}
            />

            <div className="flex items-center gap-1 mb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'h-10 w-10 rounded-xl transition-all duration-300',
                  isVoskListening
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 ring-1 ring-red-500/20'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                )}
                onClick={toggleVoiceInput}
                disabled={isLoading || voskServerStatus === false}
              >
                {voskServerStatus === null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="relative">
                    {isVoskListening && <span className="absolute inset-0 -m-1 rounded-full bg-red-500/20 animate-ping" />}
                    {isVoskListening ? <MicOff className="h-5 w-5 relative" /> : <Mic className="h-5 w-5" />}
                  </div>
                )}
              </Button>

              <Button
                type="submit"
                size="icon"
                className={cn(
                  'h-10 w-10 shrink-0 rounded-xl transition-all duration-300 shadow-md',
                  input.trim() && !isLoading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 hover:shadow-primary/20'
                    : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                )}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
