import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  dynamicTool,
  jsonSchema,
  type ToolSet,
} from 'ai';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { composioService, type RawActionData } from './composio.service';
import { getConfigValue, getLanguageInstruction } from '../lib/config';

/**
 * Build the system prompt with language configuration
 */
function buildSystemPrompt(): string {
  const languageInstruction = getLanguageInstruction();
  const preprompt = getConfigValue('llm').preprompt || '';

  return `You are a helpful and concise AI assistant. You have access to tools to interact with external services like Google Calendar, Todoist, Gmail, etc.

When using a tool:
- Briefly explain what you are doing
- Display the result in a readable and well-formatted way
- If an error occurs, explain it clearly

${preprompt ? `\nUser Instructions:\n${preprompt}\n` : ''}
${languageInstruction}`;
}

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
    // Get model from config (with fallback for backwards compatibility)
    const configModel = getConfigValue('llm').model;
    return configModel || 'xiaomi/mimo-v2-flash:free';
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
          const result = await composioService.executeTool(
            composioTool.name,
            args as Record<string, unknown>,
          );

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
    const modelMessages = await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0],
      { tools },
    );

    // Build system prompt with current config
    const systemPrompt = buildSystemPrompt();

    const result = streamText({
      model: openrouter(model),
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      system: systemPrompt,
    });

    return result;
  }
}

export const llmService = new LLMService();
