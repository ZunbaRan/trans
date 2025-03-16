import axios from 'axios';
import path from 'path';
import { createModuleLogger } from './logger';
import { ConfigLoader } from './configLoader';
import { LogConversationUtil } from './loggerUtil';

// 创建模块特定的日志记录器
const logger = createModuleLogger('deepseek-util');

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  temperature?: number;
  response_format?: {
    type: string;
  };
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
      reasoning_content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIConfig {
  title: string;
  apiKey: string;
  baseURL: string;
  model: string;
  type: string;
  compatibleMode: string;
}

interface OpenAIConfigFile {
  default: string;
  configs: OpenAIConfig[];
}

export class DeepSeekUtil {
  private url!: string;
  private apiKey!: string;
  private logDir: string;
  private model!: string;

  constructor(
    configTitle: string = 'huoshan-DeepSeek-R1',
    logDir: string = path.join(process.cwd(), 'public/logs/deepseek')
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
        apiKey: '877e8151-2569-4337-a3e2-04f6ae9d5157',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3/',
        model: 'ep-20250211101729-97nwq'
      });

      this.apiKey = config.apiKey;
      this.url = config.baseURL + "chat/completions";
      this.model = config.model;
      
    } catch (error) {
      console.error('加载配置文件失败:', error);
      // 使用默认值
      this.apiKey = '877e8151-2569-4337-a3e2-04f6ae9d5157';
      this.url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      this.model = 'ep-20250211101729-97nwq';
    }
  }

  /**
   * 发送聊天请求到 DeepSeek API
   * @param messages 消息数组
   * @param options 可选参数
   * @returns 聊天完成响应
   */
  public async chat(
    messages: Message[],
    options: {
      max_tokens?: number;
      retries?: number;
    } = {} ,
    configTitle: string = 'huoshan-DeepSeek-R1'
  ): Promise<ChatCompletionResponse> {
    // 设置默认重试次数
    const maxRetries = options.retries || 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount <= maxRetries) {
      try {
        // 确保配置已加载
        if (!this.apiKey || !this.url || !this.model) {
          await this.loadConfig(configTitle);
        }

        // 准备请求数据
        const data: ChatCompletionRequest = {
          model: this.model,
          messages,
          stream: false,
          max_tokens: options.max_tokens || 8192,
          response_format: {
            type: 'text'
          }
        };

        logger.info('发送请求到 DeepSeek API', {
          url: this.url,
          model: this.model,
          messages: messages
        });

        // 发送请求
        const response = await axios({
          method: 'post',
          url: this.url,
          data,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        // 替换原来的日志记录调用
        await LogConversationUtil.logConversation(this.logDir, messages, response.data, 'deepseek');
       

        // 检查响应是否有效
        if (!response.data || !response.data.choices || 
            !response.data.choices[0] || 
            !response.data.choices[0].message ||
            !response.data.choices[0].message.content) {
          
          // 如果是最后一次重试，则抛出错误
          if (retryCount >= maxRetries) {
            throw new Error('API 响应格式不正确或内容为空');
          }
          
          // 否则重试
          retryCount++;
          logger.warn(`API 响应内容为空，正在重试 (${retryCount}/${maxRetries})...`);
          
          // 等待一段时间再重试（指数退避）
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          continue;
        }

        return response.data;
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次重试，则记录错误并抛出
        if (retryCount >= maxRetries) {
          logger.error('DeepSeek API 请求错误', error);
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
   * 简化的单轮对话方法
   * @param prompt 用户输入
   * @returns 模型回复的内容
   */
  public async singlePrompt(
    prompt: string,
    options: {
      max_tokens?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
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
export const deepseekUtil = new DeepSeekUtil('huoshan-DeepSeek-R1');
