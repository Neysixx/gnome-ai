'use client';

import { useState, useEffect } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AppConfig {
    llm: {
        model: string;
        language: 'auto' | 'en' | 'fr';
    };
}

const LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto (detect)' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
] as const;

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load config when dialog opens
    useEffect(() => {
        if (open && !config) {
            loadConfig();
        }
    }, [open, config]);

    async function loadConfig() {
        setLoading(true);
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    }

    async function saveConfig(updates: Partial<AppConfig>) {
        setSaving(true);
        try {
            const res = await fetch('/api/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        } finally {
            setSaving(false);
        }
    }

    function handleLanguageChange(value: string) {
        if (!config) return;
        const newConfig = {
            ...config,
            llm: { ...config.llm, language: value as 'auto' | 'en' | 'fr' },
        };
        setConfig(newConfig);
        saveConfig({ llm: newConfig.llm });
    }

    function handleModelChange(value: string) {
        if (!config) return;
        const newConfig = {
            ...config,
            llm: { ...config.llm, model: value },
        };
        setConfig(newConfig);
    }

    function handleModelBlur() {
        if (!config) return;
        saveConfig({ llm: config.llm });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure the assistant behavior.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : config ? (
                    <div className="grid gap-6 py-4">
                        {/* Language */}
                        <div className="grid gap-2">
                            <Label htmlFor="language">Response Language</Label>
                            <Select
                                value={config.llm.language}
                                onValueChange={handleLanguageChange}
                                disabled={saving}
                            >
                                <SelectTrigger id="language">
                                    <SelectValue placeholder="Select a language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {config.llm.language === 'auto'
                                    ? 'The assistant will automatically detect the language.'
                                    : `The assistant will always respond in ${config.llm.language === 'fr' ? 'French' : 'English'}.`}
                            </p>
                        </div>

                        {/* Model */}
                        <div className="grid gap-2">
                            <Label htmlFor="model">LLM Model</Label>
                            <Input
                                id="model"
                                value={config.llm.model}
                                onChange={(e) => handleModelChange(e.target.value)}
                                onBlur={handleModelBlur}
                                placeholder="anthropic/claude-sonnet-4"
                                disabled={saving}
                            />
                            <p className="text-xs text-muted-foreground">
                                OpenRouter model ID (e.g., anthropic/claude-sonnet-4, openai/gpt-4o)
                            </p>
                        </div>

                        {saving && (
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Saving...
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground py-4">
                        Unable to load configuration.
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}
