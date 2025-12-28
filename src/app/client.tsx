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
import { Send, Bot, User, Loader2, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import { ModeToggle } from '@/components/ui/theme-toggle';

// Helper pour extraire le texte d'un message
function getMessageText(message: UIMessage): string {
    return message.parts
        .filter((part): part is Extract<UIMessagePart<never, never>, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('');
}

// Helper pour extraire les tool parts d'un message
function getToolParts(message: UIMessage) {
    return message.parts.filter(isToolUIPart);
}

// Helper pour obtenir l'état d'un tool call
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

    const { messages, sendMessage, status, error } = useChat({
        transport,
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const isLoading = status === 'streaming' || status === 'submitted';

    // Auto-scroll vers le bas
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    });

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

    return (
        <div className="flex h-screen flex-col bg-background">
            {/* Header */}
            <header className="border-b border-border px-6 py-4">
                <div className="mx-auto flex max-w-3xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <h1 className="font-semibold tracking-tight">Gnome AI</h1>
                    </div>
                    <div>
                        <ModeToggle />
                    </div>
                </div>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1" ref={scrollRef}>
                <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                                <Bot className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h2 className="mb-2 text-lg font-medium">Comment puis-je t&apos;aider ?</h2>
                            <p className="max-w-sm text-sm text-muted-foreground">
                                Je peux utiliser des outils MCP comme Google Calendar ou Todoist pour t&apos;assister.
                            </p>
                        </div>
                    )}

                    {messages.map((message) => {
                        const text = getMessageText(message);
                        const toolParts = getToolParts(message);

                        return (
                            <div key={message.id} className="flex gap-4">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback
                                        className={
                                            message.role === 'user'
                                                ? 'bg-secondary text-secondary-foreground'
                                                : 'bg-primary text-primary-foreground'
                                        }
                                    >
                                        {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {message.role === 'user' ? 'Vous' : 'Assistant'}
                                    </p>

                                    {/* Afficher les appels d'outils */}
                                    {toolParts.map((toolPart) => {
                                        const toolName = getToolName(toolPart);
                                        const state = getToolState(toolPart);
                                        const toolCallId = 'toolCallId' in toolPart ? toolPart.toolCallId : toolName;

                                        return (
                                            <div
                                                key={toolCallId}
                                                className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm"
                                            >
                                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-mono text-xs">
                                                    {toolName}
                                                    {state === 'result' && <span className="ml-2 text-green-600 dark:text-green-400">✓</span>}
                                                    {state === 'call' && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Contenu du message */}
                                    {text && (
                                        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none">
                                            <Markdown>{text}</Markdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Loading indicator */}
                    {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                        <div className="flex gap-4">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                    <Bot className="h-4 w-4" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2 pt-1">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Réflexion...</span>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            Erreur : {error.message}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border px-6 py-4">
                <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-3">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Écris un message..."
                        className="min-h-[52px] resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={isLoading || !input.trim()}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
