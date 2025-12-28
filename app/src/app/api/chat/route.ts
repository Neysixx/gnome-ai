import { llmService } from '@/services/llm.service';

export async function POST(request: Request) {
    const { messages } = await request.json();

    const result = await llmService.streamChat(messages);

    return result.toUIMessageStreamResponse();
}
