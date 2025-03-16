import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createModuleLogger } from './logger';
import path from 'path';

// 创建模块特定的日志记录器
const logger = createModuleLogger('base-client');

// 消息接口
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 聊天完成响应接口
export interface ChatCompletionResponse {
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

// 超时配置接口
export interface TimeoutConfig {
  total: number;    // 总超时时间(毫秒)
  connect: number;  // 连接超时时间(毫秒)
  read: number;     // 读取超时时间(毫秒)
}

// 默认超时设置
const DEFAULT_TIMEOUT: TimeoutConfig = {
  total: 600000,    // 10分钟
  connect: 10000,   // 10秒
  read: 500000      // 8.3分钟
};

/**
 * 基础客户端抽象类
 * 为不同的AI模型客户端提供通用接口和功能
 */
export abstract class BaseClient {
  protected apiKey: string;
  protected apiUrl: string;
  protected timeout: TimeoutConfig;
  protected proxy: string | null;
  protected logDir: string;

  /**
   * 初始化基础客户端
   * @param apiKey API密钥
   * @param apiUrl API地址
   * @param logDir 日志目录
   * @param timeout 超时设置，不提供则使用默认值
   * @param proxy 代理服务器地址
   */
  constructor(
    apiKey: string,
    apiUrl: string,
    logDir: string = path.join(process.cwd(), 'public/logs/ai-client'),
    timeout: Partial<TimeoutConfig> = {},
    proxy: string | null = null
  ) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.logDir = logDir;
    this.timeout = { ...DEFAULT_TIMEOUT, ...timeout };
    this.proxy = proxy;
  }

  /**
   * 创建 HTTP 代理
   * @param proxyUrl 代理服务器 URL
   * @returns 代理配置
   */
  private createProxyAgent(proxyUrl: string): any {
    try {
      // 使用 https-proxy-agent 创建代理
      const { HttpsProxyAgent } = require('https-proxy-agent');
      return new HttpsProxyAgent(proxyUrl);
    } catch (error) {
      logger.error('创建代理失败:', error);
      return undefined;
    }
  }

  /**
   * 发送 HTTP 请求
   * @param headers 请求头
   * @param data 请求数据
   * @param customTimeout 自定义超时设置
   * @param retryConfig 重试配置
   * @param customUrl 自定义 URL
   * @returns 响应数据
   */
  protected async makeRequest(
    headers: Record<string, string>,
    data: any,
    customTimeout?: Partial<TimeoutConfig>,
    retryConfig?: number,
    customUrl?: string
  ): Promise<any> {
    const url = customUrl || this.apiUrl;
    const timeout = { ...this.timeout, ...customTimeout };
    const retries = retryConfig || 3;

    // 创建请求配置
    const config: AxiosRequestConfig = {
      headers,
      timeout: timeout.total,
      timeoutErrorMessage: '请求超时',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      responseType: 'json',
      decompress: true
    };

    // 如果设置了代理，添加代理配置
    if (this.proxy) {
      // 直接使用 proxy 字段而不是 httpAgent
      config.proxy = {
        protocol: "http", 
        host: "127.0.0.1",
        port: 7890
      }
      // config.httpsAgent = this.createProxyAgent(this.proxy);
    }

    // 执行请求，支持重试
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(url, data, config);
        return response;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        if (isLastAttempt) {
          logger.error('API 请求失败:', error);
          throw error;
        } else {
          logger.warn(`API 请求失败，正在重试 (${attempt}/${retries})...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  /**
   * 流式请求处理（如果需要）
   * 这个方法可以在子类中实现，用于处理流式响应
   */
  protected async makeStreamRequest(
    headers: Record<string, string>,
    data: any,
    customTimeout?: Partial<TimeoutConfig>
  ): Promise<any> {
    // 这里可以实现流式请求处理
    // 由于JavaScript/TypeScript的异步模型与Python不同，
    // 具体实现可能需要根据实际需求调整
    throw new Error('流式请求处理未实现');
  }

  /**
   * 聊天方法，由子类实现
   * @param messages 消息列表
   * @param options 选项
   * @param configTitle 配置标题
   */
  public abstract chat(
    messages: Message[],
    options?: any,
    configTitle?: string
  ): Promise<ChatCompletionResponse>;

  /**
   * 简化的单轮对话方法
   * @param prompt 用户输入
   * @param options 选项
   * @returns 模型回复的内容
   */
  public async singlePrompt(
    prompt: string,
    options: any = {}
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