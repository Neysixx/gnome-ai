'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { QUERY_KEYS } from '@/lib/query-keys';
import type { AppConfig, LLMConfig } from '@/types/config';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto (detect)' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
] as const;

export function SettingsDialog({ config }: { config: AppConfig }) {
  const [open, setOpen] = useState(false);
  const [prepromptValue, setPrepromptValue] = useState(config?.llm.preprompt || '');
  const [modelValue, setModelValue] = useState(config?.llm.model || '');
  const queryClient = useQueryClient();

  // Reset preprompt value when config changes or dialog opens
  useEffect(() => {
    if (config?.llm.preprompt !== undefined) {
      setPrepromptValue(config.llm.preprompt || '');
    }
  }, [config?.llm.preprompt]);

  const { mutate: updateConfigMutation, isPending: isUpdatingConfig } = useMutation<
    AppConfig,
    Error,
    Partial<AppConfig>
  >({
    mutationFn: async (updates: Partial<AppConfig>) => {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update config');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONFIG] });
    },
  });

  const hasPrepromptChanged = prepromptValue !== (config?.llm.preprompt || '');
  const hasModelChanged = modelValue !== (config?.llm.model || '');

  function handlePrepromptSubmit() {
    if (!config) return;
    updateConfigMutation({ llm: { ...config.llm, preprompt: prepromptValue } });
  }

  function handleModelSubmit() {
    if (!config) return;
    updateConfigMutation({ llm: { ...config.llm, model: modelValue } });
  }

  function handleLanguageChange(value: LLMConfig['language']) {
    if (!config) return;
    updateConfigMutation({ llm: { ...config.llm, language: value } });
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
          <DialogDescription>Configure the assistant behavior.</DialogDescription>
        </DialogHeader>

        {isUpdatingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : config ? (
          <div className="grid gap-6 py-4">
            {/* Language */}
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={config.llm.language}
                onValueChange={handleLanguageChange}
                disabled={isUpdatingConfig}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="model">LLM Model</Label>
                {hasModelChanged && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={handleModelSubmit}
                    disabled={isUpdatingConfig}
                    className="h-7 gap-1.5 px-2.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </Button>
                )}
              </div>
              <Input
                id="model"
                value={modelValue}
                onChange={(e) => setModelValue(e.target.value)}
                placeholder="xiaomi/mimo-v2-flash:free"
                disabled={isUpdatingConfig}
              />
              <p className="text-xs text-muted-foreground">
                OpenRouter model ID (e.g., xiaomi/mimo-v2-flash:free, anthropic/claude-sonnet-4,
                openai/gpt-4o)
              </p>
            </div>

            {/* Preprompt */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="preprompt">Custom Instructions</Label>
                {hasPrepromptChanged && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={handlePrepromptSubmit}
                    disabled={isUpdatingConfig}
                    className="h-7 gap-1.5 px-2.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </Button>
                )}
              </div>
              <Textarea
                id="preprompt"
                value={prepromptValue}
                onChange={(e) => setPrepromptValue(e.target.value)}
                placeholder="e.g. Always be formal, or concise..."
                className="min-h-[100px] max-h-[200px]"
                disabled={isUpdatingConfig}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be added to the system prompt.
              </p>
            </div>

            {isUpdatingConfig && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Unable to load configuration.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
