import { deepseekUtil } from './deepseekUtil';
import { createModuleLogger } from './logger';
import { geminiUtil } from './geminiUtil';

const logger = createModuleLogger('DeepGemini');

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ModelArg {
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
}

interface StreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: string;
            content?: string;
            reasoning_content?: string;
        };
    }[];
}

export class DeepGemini {
    private deepseekApiKey: string;
    private geminiApiKey: string;
    private deepseekApiUrl: string;
    private geminiApiUrl: string;
    private isOriginReasoning: boolean;
    private reasoningProvider: 'deepseek' | 'gemini';

    constructor(
        deepseekApiKey: string,
        geminiApiKey: string,
        deepseekApiUrl: string = 'https://api.deepseek.com/v1/chat/completions',
        geminiApiUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models',
        isOriginReasoning: boolean = true,
        reasoningProvider: 'deepseek' | 'gemini' = 'deepseek'
    ) {
        this.deepseekApiKey = deepseekApiKey;
        this.geminiApiKey = geminiApiKey;
        this.deepseekApiUrl = deepseekApiUrl;
        this.geminiApiUrl = geminiApiUrl;
        this.isOriginReasoning = isOriginReasoning;
        this.reasoningProvider = reasoningProvider;
    }

    /**
     * 处理完整的流式输出过程
     * @param messages 初始消息列表
     * @param modelArg 模型参数
     * @param deepseekModel DeepSeek 模型名称
     * @param geminiModel Gemini 模型名称
     * @returns 流式响应生成器
     */
    async *chatCompletionsWithStream(
        messages: Message[],
        modelArg: ModelArg,
        deepseekModel: string = 'deepseek-reasoner',
        geminiModel: string = 'gemini-1.5-pro-latest'
    ): AsyncGenerator<string, void, unknown> {
        // 生成唯一的会话ID和时间戳
        const chatId = `chatcmpl-${Date.now().toString(16)}`;
        const createdTime = Math.floor(Date.now() / 1000);

        // 用于存储 DeepSeek 的推理累积内容
        let reasoningContent: string[] = [];
        let isDeepSeekDone = false;
        let isGeminiDone = false;

        try {
            // 1. 启动 DeepSeek 推理流程
            logger.info(`开始处理 DeepSeek 流，使用模型：${deepseekModel}, 提供商: ${this.reasoningProvider}`);

            // 使用 deepseekUtil 进行推理
            const deepseekResponse = await deepseekUtil.chat(
                messages.filter(m => m.role !== 'system') as any,
                {}
            );

            // 获取推理内容
            const reasoning = deepseekResponse.choices[0]?.message?.reasoning_content || '';
            reasoningContent.push(reasoning);

            // 发送推理内容的流式响应
            const reasoningChunk: StreamChunk = {
                id: chatId,
                object: 'chat.completion.chunk',
                created: createdTime,
                model: deepseekModel,
                choices: [{
                    index: 0,
                    delta: {
                        role: 'assistant',
                        reasoning_content: reasoning,
                        content: ''
                    }
                }]
            };

            yield `data: ${JSON.stringify(reasoningChunk)}\n\n`;
            isDeepSeekDone = true;
            logger.info(`DeepSeek 推理完成，收集到的推理内容长度：${reasoning.length}`);

            // 2. 启动 Gemini 流程
            if (reasoningContent.length === 0 || !reasoningContent[0]) {
                logger.warning("未能获取到有效的推理内容，将使用默认提示继续");
                reasoningContent = ["获取推理内容失败"];
            }

            // 构造 Gemini 的输入消息
            const geminiMessages = [...messages];
            const reasoning = reasoningContent.join('');

            // 改造最后一个用户消息
            const lastMessage = geminiMessages[geminiMessages.length - 1];
            if (lastMessage.role === 'user') {
                const originalContent = lastMessage.content;
                const combinedContent = `
        Here's my original input:
        ${originalContent}
        
        Here's my another model's reasoning process:
        ${reasoning}
        
        Based on this reasoning, provide your response directly to me:`;

                lastMessage.content = combinedContent;
            }

            // 移除 system 消息
            const filteredMessages = geminiMessages.filter(m => m.role !== 'system');

            logger.info(`开始处理 Gemini 流，使用模型: ${geminiModel}`);

            // 调用 Gemini API
            const geminiResponse = await geminiUtil.chat(filteredMessages, {}, 'gemini');
            const content = geminiResponse.choices[0]?.message?.content || '';

            // 发送 Gemini 内容的流式响应
            const contentChunk: StreamChunk = {
                id: chatId,
                object: 'chat.completion.chunk',
                created: createdTime,
                model: geminiModel,
                choices: [{
                    index: 0,
                    delta: {
                        role: 'assistant',
                        content: content
                    }
                }]
            };

            yield `data: ${JSON.stringify(contentChunk)}\n\n`;
            isGeminiDone = true;

        } catch (error) {
            logger.error(`处理流时发生错误: ${error}`);
        } finally {
            // 发送结束标记
            yield 'data: [DONE]\n\n';
        }
    }

    /**
     * 处理非流式输出过程
     * @param messages 初始消息列表
     * @param modelArg 模型参数
     * @param deepseekModel DeepSeek 模型名称
     * @param geminiModel Gemini 模型名称
     * @returns OpenAI 格式的完整响应
     */
    async chatCompletionsWithoutStream(
        messages: Message[],
        modelArg: ModelArg,
        deepseekModel: string = 'deepseek-reasoner',
        geminiModel: string = 'gemini-1.5-pro-latest'
    ): Promise<any> {
        const chatId = `chatcmpl-${Date.now().toString(16)}`;
        const createdTime = Math.floor(Date.now() / 1000);

        try {
            // 1. 获取 DeepSeek 的推理内容
            logger.info(`获取 DeepSeek 推理内容，使用模型：${deepseekModel}`);

            const deepseekResponse = await deepseekUtil.chat(
                messages.filter(m => m.role !== 'system') as any,
                {}
            );

            const reasoning = deepseekResponse.choices[0]?.message?.reasoning_content || '';

            if (!reasoning) {
                logger.warning("未能获取到有效的推理内容，将使用默认提示继续");
            }

            // 2. 构造 Gemini 的输入消息
            const geminiMessages = [...messages];

            // 改造最后一个用户消息
            const lastMessage = geminiMessages[geminiMessages.length - 1];
            if (lastMessage.role === 'user') {
                const originalContent = lastMessage.content;
                const combinedContent = `
        Here's my original input:
        ${originalContent}
        
        Here's my another model's reasoning process:
        ${reasoning}
        
        Based on this reasoning, provide your response directly to me:`;

                lastMessage.content = combinedContent;
            }

            // 移除 system 消息
            const filteredMessages = geminiMessages.filter(m => m.role !== 'system');

            // 3. 获取 Gemini 的非流式响应
            logger.info(`获取 Gemini 响应，使用模型: ${geminiModel}`);

            // 调用 Gemini API
            const geminiResponse = await geminiUtil.chat(filteredMessages, {}, 'gemini');

            const content = geminiResponse.choices[0]?.message?.content || '';

            // 4. 构造 OpenAI 格式的响应
            // 简单估算 token 数量
            const inputTokens = JSON.stringify(messages).length / 4;
            const outputTokens = content.length / 4;

            return {
                id: chatId,
                object: 'chat.completion',
                created: createdTime,
                model: geminiModel,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: content,
                        reasoning_content: reasoning
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: Math.ceil(inputTokens),
                    completion_tokens: Math.ceil(outputTokens),
                    total_tokens: Math.ceil(inputTokens + outputTokens)
                }
            };

        } catch (error) {
            logger.error(`处理非流式输出时发生错误: ${error}`);
            throw error;
        }
    }


    /**
     * 将消息列表转换为 Gemini 格式
     * @param messages OpenAI 格式的消息列表
     * @returns Gemini 格式的消息
     */
    private convertMessagesToGeminiFormat(messages: Message[]): any[] {
        // 简化处理，实际应根据 Gemini API 的具体要求进行转换
        const geminiContents = [];
        let currentRole = null;
        let currentParts = [];

        for (const message of messages) {
            if (message.role === 'system') {
                // Gemini 不支持 system 角色，可以将其作为 user 的第一条消息
                geminiContents.push({
                    role: 'user',
                    parts: [{ text: message.content }]
                });
            } else if (message.role !== currentRole) {
                // 角色变化，创建新的消息
                if (currentRole) {
                    geminiContents.push({
                        role: currentRole === 'user' ? 'user' : 'model',
                        parts: currentParts
                    });
                }
                currentRole = message.role;
                currentParts = [{ text: message.content }];
            } else {
                // 同一角色的连续消息，合并内容
                currentParts.push({ text: message.content });
            }
        }

        // 添加最后一组消息
        if (currentRole) {
            geminiContents.push({
                role: currentRole === 'user' ? 'user' : 'model',
                parts: currentParts
            });
        }

        return geminiContents;
    }

    /**
     * 将 Gemini 响应转换为 OpenAI 格式
     * @param geminiResponse Gemini API 响应
     * @returns OpenAI 格式的响应
     */
    private convertGeminiResponseToOpenAIFormat(geminiResponse: any): any {
        // 简化处理，实际应根据 Gemini API 的具体响应格式进行转换
        const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            choices: [{
                message: {
                    role: 'assistant',
                    content: content
                }
            }]
        };
    }
}

// 导出单例实例
export const deepGemini = new DeepGemini(
    process.env.DEEPSEEK_API_KEY || '',
    process.env.GEMINI_API_KEY || ''
);
