'use client';

import { useChat } from '@ai-sdk/react';
import {
    type UIMessage,
    type UIMessagePart,
    isToolUIPart,
    getToolName,
    DefaultChatTransport,
} from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, Loader2, Wrench, Trash } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import { ModeToggle } from '@/components/ui/theme-toggle';
import { SettingsDialog } from '@/components/settings-dialog';
import { cn } from '@/lib/utils';

// Helper to extract text from a message
function getMessageText(message: UIMessage): string {
    return message.parts
        .filter((part): part is Extract<UIMessagePart<never, never>, { type: 'text' }> => part.type === 'text')
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

export default function Client() {
    const [input, setInput] = useState('');

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
    }, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: input }],
        });
        setInput('');
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
    };

    return (
        <div className="flex h-screen flex-col bg-background font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                    </div>
                    <h1 className="text-lg font-semibold tracking-tight">Gnome AI</h1>
                </div>
                <div className="flex items-center gap-2">
                    <SettingsDialog />
                    <ModeToggle />
                </div>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1">
                <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
                    {messages.length === 0 && (
                        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
                            <h2 className="mb-3 text-2xl font-semibold tracking-tight">How can I help you today?</h2>
                            <p className="max-w-md text-muted-foreground">
                                I'm your AI assistant capable of using tools like Google Calendar or Todoist to help manage your tasks.
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
                                className={cn(
                                    "flex w-full gap-4",
                                    isUser ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                <Avatar className={cn(
                                    "h-8 w-8 shrink-0",
                                    isUser ? "hidden" : "block"
                                )}>
                                    <AvatarFallback
                                        className={cn(
                                            "bg-primary/10 text-primary"
                                        )}
                                    >
                                        <Bot className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>

                                <div className={cn(
                                    "relative max-w-[85%] space-y-2",
                                    isUser ? "ml-auto" : "mr-auto"
                                )}>
                                    {/* Tool Calls */}
                                    {toolParts.length > 0 && (
                                        <div className="mb-2 space-y-2">
                                            {toolParts.map((toolPart) => {
                                                const toolName = getToolName(toolPart);
                                                const state = getToolState(toolPart);
                                                const toolCallId = 'toolCallId' in toolPart ? toolPart.toolCallId : toolName;

                                                return (
                                                    <div
                                                        key={toolCallId}
                                                        className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
                                                    >
                                                        <Wrench className="h-3.5 w-3.5" />
                                                        <span className="font-mono">{toolName}</span>
                                                        <div className="ml-auto flex items-center">
                                                            {state === 'result' && <span className="text-emerald-400">Completed</span>}
                                                            {state === 'call' && <Loader2 className="h-3 w-3 animate-spin" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Text Content */}
                                    {text && (
                                        <div className={cn(
                                            "prose prose-sm max-w-none wrap-break-word rounded-2xl px-5 py-3.5 shadow-sm",
                                            isUser
                                                ? "bg-primary text-primary-foreground prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground"
                                                : "bg-muted/20 text-foreground border border-border/50"
                                        )}>
                                            <Markdown
                                                components={{
                                                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                    code: ({ children }) => <code className="bg-foreground/10 rounded px-1 py-0.5 font-mono text-sm">{children}</code>,
                                                    pre: ({ children }) => <pre className="bg-foreground/90 p-4 rounded-lg overflow-x-auto text-foreground my-2">{children}</pre>,
                                                    strong: ({ children }) => <strong className={cn("font-bold", !isUser && "text-primary/80")}>{children}</strong>
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
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    <Bot className="h-4 w-4" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1 rounded-2xl bg-muted/50 px-4 py-3">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            <span className="font-semibold">Error:</span> {error.message}
                        </div>
                    )}

                    {/* Anchor for auto-scroll */}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Footer Input Area */}
            <div className="p-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="mx-auto max-w-3xl">
                    <form onSubmit={handleSubmit} className="relative flex items-center gap-2 rounded-xl border border-input bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            onClick={handleClear}
                            title="Clear History"
                        >
                            <Trash className="h-4 w-4" />
                        </Button>

                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Message Gnome AI..."
                            className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
                            rows={1}
                            disabled={isLoading}
                        />

                        <Button
                            type="submit"
                            size="icon"
                            className={cn(
                                "h-9 w-9 shrink-0 transition-all",
                                !input.trim() || isLoading ? "opacity-50" : "opacity-100"
                            )}
                            disabled={isLoading || !input.trim()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                    <div className="mt-2 text-center text-xs text-muted-foreground">
                        Gnome AI can make mistakes. Please double-check important information.
                    </div>
                </div>
            </div>
        </div>
    );
}