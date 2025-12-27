import { streamText, convertToModelMessages, type CoreTool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { composioService, type RawActionData } from './composio.service';
import { z } from 'zod';

const SYSTEM_PROMPT = `Tu es un assistant IA utile et concis. Tu as accès à des outils pour interagir avec des services externes comme Google Calendar, Todoist, Gmail, etc.

Quand tu utilises un outil:
- Explique brièvement ce que tu fais
- Affiche le résultat de manière lisible
- Si une erreur survient, explique-la clairement

Réponds toujours en français sauf si l'utilisateur parle une autre langue.`;

/**
 * Service for LLM interactions with OpenRouter
 */
class LLMService {
    private openrouter: ReturnType<typeof createOpenRouter> | null = null;

    private getOpenRouter() {
        if (!this.openrouter) {
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                throw new Error('OPENROUTER_API_KEY is not set');
            }
            this.openrouter = createOpenRouter({ apiKey });
        }
        return this.openrouter;
    }

    private getModel(): string {
        const model = process.env.LLM_MODEL;
        if (!model) {
            throw new Error('LLM_MODEL is not set');
        }
        return model;
    }

    /**
     * Convert Composio tools to AI SDK CoreTool format
     */
    private convertToAISDKTools(composioTools: RawActionData[]): Record<string, CoreTool> {
        const tools: Record<string, CoreTool> = {};

        for (const tool of composioTools) {
            const inputSchema = tool.parameters as { properties?: Record<string, any>; required?: string[] } | undefined;

            tools[tool.name] = {
                description: tool.description || `Execute ${tool.name}`,
                parameters: inputSchema?.properties
                    ? z.object(
                        Object.fromEntries(
                            Object.entries(inputSchema.properties).map(([key, value]: [string, any]) => {
                                let schema: z.ZodTypeAny;

                                switch (value.type) {
                                    case 'string':
                                        schema = z.string();
                                        break;
                                    case 'number':
                                    case 'integer':
                                        schema = z.number();
                                        break;
                                    case 'boolean':
                                        schema = z.boolean();
                                        break;
                                    case 'array':
                                        schema = z.array(z.any());
                                        break;
                                    case 'object':
                                        schema = z.record(z.any());
                                        break;
                                    default:
                                        schema = z.any();
                                }

                                // Add description if available
                                if (value.description) {
                                    schema = schema.describe(value.description);
                                }

                                // Make optional if not in required array
                                if (!inputSchema.required?.includes(key)) {
                                    schema = schema.optional();
                                }

                                return [key, schema];
                            }),
                        ),
                    )
                    : z.object({}),
                execute: async (args) => {
                    const result = await composioService.executeTool(tool.name, args);
                    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                },
            };
        }

        return tools;
    }

    /**
     * Stream a chat response with tool support
     */
    async streamChat(messages: any[], entityId = 'default') {
        const openrouter = this.getOpenRouter();
        const model = this.getModel();

        // Get available tools from Composio
        const composioTools = await composioService.getTools(entityId);
        const tools = this.convertToAISDKTools(composioTools);

        // Convert UI messages to model messages
        const modelMessages = await convertToModelMessages(messages, { tools });

        const result = streamText({
            model: openrouter(model),
            messages: modelMessages,
            tools,
            maxSteps: 10,
            system: SYSTEM_PROMPT,
        });

        return result;
    }
}

export const llmService = new LLMService();

