import { BaseClient, Message, ChatCompletionResponse, TimeoutConfig } from './baseClient';
import { createModuleLogger } from './logger';
import { ConfigLoader } from './configLoader';
import { LogConversationUtil } from './loggerUtil';
import path from 'path';
import axios from 'axios';

// 创建模块特定的日志记录器
const logger = createModuleLogger('claude-client');

// 在类外部定义接口
interface AnthropicRequestData {
  model: string;
  messages: any[];
  max_tokens: number;
  stream: boolean;
  temperature: number;
  top_p: number;
  system?: string; // 添加可选的 system 属性
}

/**
 * Claude API 客户端
 * 支持多种提供商: Anthropic、OpenRouter、OneAPI
 */
export class ClaudeClient extends BaseClient {
  private model: string = 'claude-3-sonnet-20240229';
  private provider: string = 'anthropic';  // 'anthropic', 'openrouter', 'oneapi'

  /**
   * 初始化 Claude 客户端
   * @param apiKey API密钥
   * @param apiUrl API地址
   * @param provider API提供商
   * @param model 模型名称
   * @param logDir 日志目录
   * @param timeout 超时设置
   * @param proxy 代理服务器地址
   */
  constructor(
    apiKey: string,
    apiUrl: string = 'https://api.anthropic.com/v1/messages',
    provider: string = 'anthropic',
    model: string = 'claude-3-sonnet-20240229',
    logDir: string = path.join(process.cwd(), 'public/logs/claude'),
    timeout: Partial<TimeoutConfig> = {},
    proxy: string | null = null
  ) {
    super(apiKey, apiUrl, logDir, timeout, proxy);
    this.provider = provider;
    this.model = model;
  }

  /**
   * 从配置加载客户端
   * @param configTitle 配置标题
   * @returns ClaudeClient 实例
   */
  public static async fromConfig(configTitle: string = 'claude'): Promise<ClaudeClient> {
    try {
      // 使用通用配置加载器
      const config = await ConfigLoader.getConfig(configTitle, {
        apiKey: process.env.CLAUDE_API_KEY || '',
        model: 'claude-3-sonnet-20240229',
        baseURL: 'https://api.anthropic.com/v1/messages',
        provider: 'anthropic',
        proxy: null
      });

      return new ClaudeClient(
        config.apiKey,
        config.baseURL,
        config.provider,
        config.model,
        path.join(process.cwd(), 'public/logs/claude'),
        undefined,
        config.proxy
      );
    } catch (error) {
      logger.error('加载配置文件失败:', error);
      // 使用环境变量作为备选
      return new ClaudeClient(
        process.env.CLAUDE_API_KEY || '',
        'https://api.anthropic.com/v1/messages',
        'anthropic',
        'claude-3-sonnet-20240229'
      );
    }
  }

  /**
   * 发送聊天请求
   * @param messages 消息数组
   * @param options 可选参数
   * @param configTitle 配置标题
   * @returns 聊天完成响应
   */
  public async chat(
    messages: Message[],
    options: {
      temperature?: number;
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      maxTokens?: number;
      stream?: boolean;
      systemPrompt?: string;
      retries?: number;
    } = {},
    configTitle: string = 'claude'
  ): Promise<ChatCompletionResponse> {
    // 根据提供商选择处理方法
    switch (this.provider) {
      case 'openrouter':
        return this.handleOpenRouterRequest(messages, options);
      case 'oneapi':
        return this.handleOneAPIRequest(messages, options);
      case 'anthropic':
        return this.handleAnthropicRequest(messages, options);
      default:
        throw new Error(`不支持的Claude提供商: ${this.provider}`);
    }
  }

  /**
   * 处理 Anthropic 原生 API 请求
   */
  private async handleAnthropicRequest(
    messages: Message[],
    options: any
  ): Promise<ChatCompletionResponse> {
    const headers = {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "accept": options.stream ? "text/event-stream" : "application/json",
    };

    // 处理消息格式
    const processedMessages = this.convertToAnthropicFormat(messages);

    const data: AnthropicRequestData = {
      model: this.model,
      messages: processedMessages,
      max_tokens: options.maxTokens ?? 8192,
      stream: options.stream ?? false,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.95,
    };

    // 添加系统提示
    if (options.systemPrompt) {
      data.system = options.systemPrompt;
    }

    logger.debug('开始对话:', data);

    // 发送请求
    const response = await this.makeRequest(headers, data);
    
    // 记录对话
    await LogConversationUtil.logConversation(this.logDir, messages, response.data, 'anthropic');
    
    // 转换为标准格式
    return this.convertAnthropicResponseToStandard(response.data);
  }

  /**
   * 处理 OpenRouter 请求
   */
  private async handleOpenRouterRequest(
    messages: Message[],
    options: any
  ): Promise<ChatCompletionResponse> {
    // 转换模型名称为 OpenRouter 格式
    const openRouterModel = "anthropic/claude-3.5-sonnet";

    const headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/ErlichLiu/DeepClaude",  // OpenRouter 需要
      "X-Title": "DeepClaude",  // OpenRouter 需要
    };

    // 处理系统提示
    let processedMessages = [...messages];
    if (options.systemPrompt) {
      processedMessages.unshift({
        role: 'system',
        content: options.systemPrompt
      });
    }

    const data = {
      model: openRouterModel,
      messages: processedMessages,
      stream: options.stream ?? false,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.95,
      presence_penalty: options.presencePenalty ?? 0,
      frequency_penalty: options.frequencyPenalty ?? 0,
      max_tokens: options.maxTokens ?? 8192
    };

    logger.debug('开始对话:', data);

    // 发送请求
    const response = await this.makeRequest(headers, data);
    
    // 记录对话
    await LogConversationUtil.logConversation(this.logDir, messages, response.data, 'openrouter');
    
    return response.data;
  }

  /**
   * 处理 OneAPI 请求
   */
  private async handleOneAPIRequest(
    messages: Message[],
    options: any
  ): Promise<ChatCompletionResponse> {
    const headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    // 处理系统提示
    let processedMessages = [...messages];
    if (options.systemPrompt) {
      processedMessages.unshift({
        role: 'system',
        content: options.systemPrompt
      });
    }

    const data = {
      model: this.model,
      messages: processedMessages,
      stream: options.stream ?? false,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.95,
      presence_penalty: options.presencePenalty ?? 0,
      frequency_penalty: options.frequencyPenalty ?? 0,
      max_tokens: options.maxTokens ?? 8192
    };

    logger.debug('开始对话:', data);

    // 发送请求
    const response = await this.makeRequest(headers, data);
    
    // 记录对话
    await LogConversationUtil.logConversation(this.logDir, messages, response.data, 'oneapi');
    
    return response.data;
  }

  /**
   * 将标准消息格式转换为 Anthropic 格式
   */
  private convertToAnthropicFormat(messages: Message[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  /**
   * 将 Anthropic 响应转换为标准格式
   */
  private convertAnthropicResponseToStandard(response: any): ChatCompletionResponse {
    const content = response.content?.[0]?.text || '';
    
    return {
      id: response.id || `claude-${Date.now().toString(16)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content
        }
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * 流式聊天（实验性功能）
   * 注意：这是一个简化的实现，实际使用时可能需要更复杂的处理
   */
  public async *streamChat(
    messages: Message[],
    options: {
      temperature?: number;
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      systemPrompt?: string;
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    // 构建请求参数
    const modelArg = [
      options.temperature ?? 0.7,
      options.topP ?? 0.95,
      options.presencePenalty ?? 0,
      options.frequencyPenalty ?? 0
    ];

    // 根据提供商选择不同的处理方式
    if (this.provider === 'anthropic') {
      const headers = {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "accept": "text/event-stream"
      };

      // 处理消息格式
      const processedMessages = this.convertToAnthropicFormat(messages);

      const data: AnthropicRequestData = {
        model: this.model,
        messages: processedMessages,
        max_tokens: 8192,
        stream: true,
        temperature: modelArg[0],
        top_p: modelArg[1]
      };

      // 添加系统提示
      if (options.systemPrompt) {
        data.system = options.systemPrompt;
      }

      try {
        // 使用 axios 发送流式请求
        const response = await axios.post(this.apiUrl, data, {
          headers,
          responseType: 'stream'
        });

        // 处理流式响应
        for await (const chunk of response.data) {
          const chunkStr = chunk.toString('utf-8');
          
          // 处理每一行
          for (const line of chunkStr.split('\n')) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.substring(6);
              if (jsonStr.trim() === '[DONE]') {
                return;
              }

              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'content_block_delta') {
                  const content = data.delta?.text || '';
                  if (content) {
                    yield content;
                  }
                }
              } catch (e) {
                // 忽略 JSON 解析错误
              }
            }
          }
        }
      } catch (error) {
        logger.error('流式请求失败:', error);
        throw error;
      }
    } else {
      // 对于其他提供商，可以实现类似的逻辑
      throw new Error(`暂不支持 ${this.provider} 的流式输出`);
    }
  }
}

// 导出单例实例
export const claudeClient = await ClaudeClient.fromConfig('claude'); 