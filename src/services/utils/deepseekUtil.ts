import axios from 'axios';
import * as fs from 'fs/promises';
import path from 'path';
import moment from 'moment';
import { createModuleLogger } from './logger';

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
  n?: number;
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
  private url: string;
  private apiKey: string;
  private logDir: string;
  private model: string;

  constructor(
    configTitle: string = 'deepseek-r1',
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
      // 读取配置文件
      const configPath = path.join(process.cwd(), 'src/config/openai.config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config: OpenAIConfigFile = JSON.parse(configData);
      
      // 查找指定标题的配置
      const targetConfig = config.configs.find(c => c.title === configTitle);
      
      if (!targetConfig) {
        console.warn(`未找到标题为 "${configTitle}" 的配置，使用默认配置`);
        this.apiKey = '877e8151-2569-4337-a3e2-04f6ae9d5157';
        this.url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        this.model = 'ep-20250211101729-97nwq';
      } else {
        this.apiKey = targetConfig.apiKey;
        this.url = targetConfig.baseURL + "chat/completions";
        this.model = targetConfig.model;
        console.log(`已加载 "${configTitle}" 配置`);
      }
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
      frequency_penalty?: number;
      presence_penalty?: number;
    } = {}
  ): Promise<ChatCompletionResponse> {
    try {
      // 确保配置已加载
      if (!this.apiKey || !this.url || !this.model) {
        await this.loadConfig('deepseek-r1');
      }

      // 准备请求数据
      const data: ChatCompletionRequest = {
        model: this.model,
        messages,
        stream: false,
        max_tokens: options.max_tokens || 4096,
        n: 1,
        response_format: {
          type: 'text'
        }
      };

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

      // 记录响应
      await this.logConversation(messages, response.data);

      return response.data;
    } catch (error) {
      console.error('DeepSeek API 请求错误:', error);
      throw error;
    }
  }

  /**
   * 记录对话到日志文件
   * @param messages 消息数组
   * @param response API 响应
   */
  private async logConversation(
    messages: Message[],
    response: ChatCompletionResponse | null
  ): Promise<void> {
    try {
      // 确保日志目录存在
      await fs.mkdir(this.logDir, { recursive: true });

      const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
      const logFile = path.join(this.logDir, `conversation-${timestamp}.json`);

      // 提取需要记录的响应内容
      const responseContent = response ? {
        content: response.choices[0]?.message?.content,
        reasoning_content: response.choices[0]?.message?.reasoning_content
      } : null;
      // 创建日志内容

      // const logContent = {
      //   timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      //   request: {
      //     messages
      //   },
      //   response: responseContent
      // };
      // // 写入日志文件
      // await fs.writeFile(logFile, JSON.stringify(logContent, null, 2), 'utf-8');

    
      
      // 使用 logger 记录信息
      logger.info('对话已记录到文件', { 
        logFile,
        requestMessagesCount: messages.length,
        hasResponse: !!response,
        model: this.model
      });
      
      // 记录请求和响应的简要信息
      logger.debug('对话详情', {
        lastUserMessage: messages.length > 0 ? 
          messages[messages.length - 1].content.substring(0, 100) + '...': '',
        responsePreview: responseContent?.content ? 
          responseContent.content.substring(0, 100) + '...': '无响应',
        responseReason: responseContent?.reasoning_content ? 
          responseContent.reasoning_content.substring(0, 100) + '...': '无推理'
      });
    } catch (error) {
      // 使用 logger 记录错误
      logger.error('记录对话失败', { 
        error, 
        messagesCount: messages.length,
        logDir: this.logDir
      });
    }
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
export const deepseekUtil = new DeepSeekUtil('deepseek-r1');
