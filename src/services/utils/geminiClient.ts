import { BaseClient, Message, ChatCompletionResponse, TimeoutConfig } from './baseClient';
import { createModuleLogger } from './logger';
import { ConfigLoader } from './configLoader';
import { LogConversationUtil } from './loggerUtil';
import path from 'path';

// 创建模块特定的日志记录器
const logger = createModuleLogger('gemini-client');

// Gemini API 请求数据接口
interface GeminiRequestData {
  contents: {
    role: string;
    parts: { text: string }[];
  }[];
  generationConfig: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens: number;
  };
}

/**
 * Gemini API 客户端
 * 支持直接调用 Gemini API，可以使用代理
 */
export class GeminiClient extends BaseClient {
  private model: string = 'gemini-2.0-flash';

  /**
   * 初始化 Gemini 客户端 
   * configTitle 如果为空，则使用默认的模型
   * @param configTitle 配置标题
   * @param logDir 日志目录
   */
  constructor(
    configTitle: string,
    logDir: string = path.join(process.cwd(), 'public/logs/gemini')
  ) {
    if (!configTitle) {
      throw new Error('必须提供 configTitle');
    }
    
    // 先用空值初始化基类，后续在 loadConfig 中设置实际值
    super('', '', logDir);
    this.loadConfig(configTitle);
  }

  /**
   * 从配置文件加载配置
   * 代理默认使用 localhost:7890
   */
  private async loadConfig(configTitle: string): Promise<void> {
    try {
      // 使用通用配置加载器
      const config = await ConfigLoader.getConfig(configTitle, {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: configTitle,  // 使用传入的 configTitle 作为默认模型名
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
        proxy: null
      });

      this.apiKey = config.apiKey;
      this.apiUrl = config.baseURL;
      this.model = config.model;  // 先设置模型
      
      // 然后再构建完整的 API URL
      this.apiUrl = `${this.apiUrl}/${this.model}:generateContent?key=${this.apiKey}`;
      this.proxy = 'http://127.0.0.1:7890';
    } catch (error) {
      logger.error('加载配置文件失败:', error);
      // 使用默认值
      this.apiKey = process.env.GEMINI_API_KEY || '';
      this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
      this.model = configTitle;  // 使用传入的 configTitle
      
      // 构建完整的 API URL
      this.apiUrl = `${this.apiUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    }
  }

  /**
   * 发送聊天请求
   * @param messages 消息数组
   * @param options 可选参数
   * @returns 聊天完成响应
   */
  public async chat(
    messages: Message[],
    options: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxOutputTokens?: number;
      retries?: number;
    } = {}
  ): Promise<ChatCompletionResponse> {
    // 转换消息格式为 Gemini 格式
    const geminiMessages = this.convertToGeminiFormat(messages);
    
    logger.info('发送请求到 Gemini API', {
      model: this.model,
      messagesCount: messages.length
    });

    // 设置请求头
    const headers = {
      'Content-Type': 'application/json'
    };

    // 设置生成配置
    const data: GeminiRequestData = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        temperature: options.temperature ?? 1.5
      }
    };

    // 如果提供了 topK，添加到配置中
    if (options.topK !== undefined) {
      data.generationConfig.topK = options.topK;
    }

    try {
      // 发送请求
      const response = await super.makeRequest(headers, data, undefined, undefined);
      
      // 解析响应
      const result = response.data;
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // 创建 OpenAI 格式的响应
      const chatResponse: ChatCompletionResponse = {
        id: `gemini-${Date.now().toString(16)}`,
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
          // Gemini API 不提供 token 计数，这里使用简单估算
          prompt_tokens: Math.ceil(JSON.stringify(messages).length / 4),
          completion_tokens: Math.ceil(content.length / 4),
          total_tokens: Math.ceil((JSON.stringify(messages).length + content.length) / 4)
        }
      };

      // 尝试记录对话，但不让日志错误影响主流程
      try {
        await LogConversationUtil.logConversation(this.logDir, messages, chatResponse, 'gemini');
      } catch (error) {
        logger.warn('记录对话失败', error);
      }

      return chatResponse;
    } catch (error) {
      logger.error('Gemini API 请求错误', error);
      throw error;
    }
  }

  /**
   * 将 OpenAI 格式的消息转换为 Gemini 格式
   */
  private convertToGeminiFormat(messages: Message[]): any[] {
    const geminiContents = [];
    let currentRole = null;
    let currentParts: {text: string}[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini 不支持 system 角色，将其作为 user 的消息
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
   * 简化的单轮对话方法
   * @param prompt 用户输入
   * @returns 模型回复的内容
   */
  public async singlePrompt(
    prompt: string,
    options: {
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
    } = {}
  ): Promise<string> {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await this.chat(messages, options);
    return response.choices[0]?.message?.content || '';
  }
}

// 导出单例实例
export const geminiClient = new GeminiClient('gemini-2.0-flash'); 

export const thinkingGeminiClient = new GeminiClient('gemini-2.0-flash-thinking-exp');