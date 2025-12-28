import { streamText, convertToModelMessages, stepCountIs, dynamicTool, jsonSchema, type ToolSet } from 'ai';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { composioService, type RawActionData } from './composio.service';

const SYSTEM_PROMPT = `Tu es un assistant IA utile et concis. Tu as accès à des outils pour interagir avec des services externes comme Google Calendar, Todoist, Gmail, etc.

Quand tu utilises un outil:
- Explique brièvement ce que tu fais
- Affiche le résultat de manière lisible et bien formatée
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
     * Convert Composio tools to AI SDK dynamicTool format
     */
    private convertToAISDKTools(composioTools: RawActionData[]): ToolSet {
        const tools: ToolSet = {};

        for (const composioTool of composioTools) {
            tools[composioTool.name] = dynamicTool({
                description: composioTool.description || `Execute ${composioTool.name}`,
                inputSchema: jsonSchema(composioTool.parameters as JSONSchema7),
                execute: async (args) => {
                    const result = await composioService.executeTool(composioTool.name, args as Record<string, unknown>);

                    // Format the result for the LLM
                    if (!result.successful) {
                        return `Error: ${result.error || 'Unknown error occurred'}`;
                    }

                    // Return the data in a readable format
                    return JSON.stringify(result.data, null, 2);
                },
            });
        }

        return tools;
    }

    /**
     * Stream a chat response with tool support
     */
    async streamChat(messages: unknown[], entityId = 'default') {
        const openrouter = this.getOpenRouter();
        const model = this.getModel();

        // Get available tools from Composio
        const composioTools = await composioService.getTools(entityId);
        const tools = this.convertToAISDKTools(composioTools);

        // Convert UI messages to model messages
        const modelMessages = await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0], { tools });

        const result = streamText({
            model: openrouter(model),
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(10), // Allow multiple steps so LLM can respond after tool execution
            system: SYSTEM_PROMPT,
        });

        return result;
    }
}

export const llmService = new LLMService();
