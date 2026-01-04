
/**
 * Application configuration types
 */
export interface LLMConfig {
    model: string;
    language: 'auto' | 'en' | 'fr';
    preprompt?: string;
}

export interface AppConfig extends Record<string, unknown> {
    llm: LLMConfig;
}
