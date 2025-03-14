import path from 'path';
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { createModuleLogger } from './logger';
import { ConfigLoader } from './configLoader';
import { LogConversationUtil } from './loggerUtil';

// 创建模块特定的日志记录器
const logger = createModuleLogger('gemini-util');

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GeminiConfig {
  title: string;
  apiKey: string;
  model: string;
}

interface OpenAIConfigFile {
  default: string;
  configs: any[];
}

export class GeminiUtil {
  private apiKey: string = '';
  private model: string = 'gemini-1.5-pro';
  private logDir: string;
  private genAI: GoogleGenerativeAI | null = null;
  private generativeModel: GenerativeModel | null = null;
  private baseUrl: string;

  constructor(
    configTitle: string = 'gemini',
    logDir: string = path.join(process.cwd(), 'public/logs/gemini')
  ) {
    this.logDir = logDir;
    this.loadConfig(configTitle);
  }

  /**
   * 从配置文件加载配置
   */
  private async loadConfig(configTitle: string): Promise<void> {
    try {
      // 使用通用配置加载器
      const config = await ConfigLoader.getConfig(configTitle, {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-1.5-pro',
        baseURL: ''
      });

      this.apiKey = config.apiKey;
      this.model = config.model;
      this.baseUrl = config.baseURL;

      // 初始化 Gemini 客户端
      if (this.apiKey) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.generativeModel = this.genAI.getGenerativeModel({ model: this.model });
      } else {
        logger.error('Gemini API Key 未设置，无法初始化客户端');
      }
    } catch (error) {
      logger.error('加载配置文件失败:', error);
      // 使用环境变量作为备选
      this.apiKey = process.env.GEMINI_API_KEY || '';
      this.model = 'gemini-1.5-pro';
      
      if (this.apiKey) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.generativeModel = this.genAI.getGenerativeModel({ model: this.model });
      }
    }
  }

  /**
   * 发送聊天请求到 Gemini API
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
    } = {},
    configTitle: string = 'gemini'
  ): Promise<ChatCompletionResponse> {
    // 设置默认重试次数
    const maxRetries = options.retries || 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount <= maxRetries) {
      try {
        // 确保配置已加载
        if (!this.genAI || !this.generativeModel) {
          await this.loadConfig(configTitle);
          
          if (!this.genAI || !this.generativeModel) {
            throw new Error('Gemini 客户端初始化失败');
          }
        }

        // 转换消息格式为 Gemini 格式
        const geminiMessages = this.convertToGeminiFormat(messages);
        
        logger.info('发送请求到 Gemini API', {
          model: this.model,
          messagesCount: messages.length
        });

        // 设置生成配置
        const generationConfig = {
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.95,
          topK: options.topK || 40,
          maxOutputTokens: options.maxOutputTokens || 8192,
        };

        // 发送请求
        const result = await this.generativeModel.generateContent({
          contents: geminiMessages,
          generationConfig
        });

        const response = result.response;
        const content = response.text();
        
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
        await LogConversationUtil.logConversation(this.logDir, messages, chatResponse, 'gemini');

        return chatResponse;
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次重试，则记录错误并抛出
        if (retryCount >= maxRetries) {
          logger.error('Gemini API 请求错误', error);
          throw error;
        }
        
        // 否则重试
        retryCount++;
        logger.warn(`API 请求失败，正在重试 (${retryCount}/${maxRetries})...`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // 等待一段时间再重试（指数退避）
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }

    // 如果所有重试都失败，抛出最后一个错误
    logger.error('所有重试都失败', lastError);
    throw lastError;
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
export const geminiUtil = new GeminiUtil('gemini'); 