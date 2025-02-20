import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ApiConfig {
  title: string;
  apiKey: string;
  baseURL: string;
  model: string;
  type: 'normal' | 'reasoner';
  compatibleMode: 'openai' | 'gemini';
}

interface OpenAIConfig {
  default: string;
  configs: ApiConfig[];
}

export class OpenAIClientManager {
  private static instance: OpenAIClientManager;
  private configs: ApiConfig[] = [];
  private clients: Map<string, { 
    client: OpenAI | GoogleGenerativeAI; 
    model: string; 
    type: 'normal' | 'reasoner';
    compatibleMode: 'openai' | 'gemini';
  }> = new Map();
  private currentConfigIndex = 0;
  private defaultTitle: string = '';

  private constructor() {
    console.log('OpenAIClientManager 开始初始化...');
  }

  public static async getInstance(): Promise<OpenAIClientManager> {
    console.log('OpenAIClientManager.getInstance() 被调用');
    if (!OpenAIClientManager.instance) {
      console.log('创建新的 OpenAIClientManager 实例');
      OpenAIClientManager.instance = new OpenAIClientManager();
      await OpenAIClientManager.instance.initialize();
    }
    return OpenAIClientManager.instance;
  }

  private async initialize() {
    try {
      const configFile = await fs.readFile(path.join(process.cwd(), 'src/config/openai.config.json'), 'utf8');
      const config = JSON.parse(configFile);
      this.configs = config.configs;
      this.defaultTitle = config.default;

      for (const cfg of this.configs) {
        if (cfg.compatibleMode === 'gemini') {
          const genAI = new GoogleGenerativeAI(cfg.apiKey);
          this.clients.set(cfg.title, {
            client: genAI,
            model: cfg.model,
            type: cfg.type,
            compatibleMode: cfg.compatibleMode
          });
        } else {
          // OpenAI compatible clients
          const client = new OpenAI({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
          });
          this.clients.set(cfg.title, {
            client,
            model: cfg.model,
            type: cfg.type,
            compatibleMode: cfg.compatibleMode
          });
        }
      }
    } catch (error) {
      console.error('Error initializing OpenAIClientManager:', error);
      throw error;
    }
  }

  public getCurrentClient(): { client: OpenAI | GoogleGenerativeAI; model: string; type: 'normal' | 'reasoner'; compatibleMode: 'openai' | 'gemini' } {
    const config = this.configs[this.currentConfigIndex];
    const client = this.clients.get(config.title);
    if (!client) {
      throw new Error(`Client not found for config: ${config.title}`);
    }
    return client;
  }

  public getClientByTitle(title: string): { client: OpenAI | GoogleGenerativeAI; model: string; type: 'normal' | 'reasoner'; compatibleMode: 'openai' | 'gemini' } {
    const client = this.clients.get(title);
    if (!client) {
      throw new Error(`Client not found for title: ${title}`);
    }
    return client;
  }

  // 获取所有 normal 类型的配置索引
  private getNormalConfigIndexes(): number[] {
    return this.configs
      .map((config, index) => ({ index, type: config.type }))
      .filter(item => item.type === 'normal')
      .map(item => item.index);
  }

  // 修改后的 executeWithFallback，只使用 normal 类型的模型
  public async executeWithFallback<T>(
    operation: (client: OpenAI | GoogleGenerativeAI, model: string) => Promise<T>
  ): Promise<T> {
    const normalIndexes = this.getNormalConfigIndexes();
    if (normalIndexes.length === 0) {
      throw new Error('No normal type configurations available');
    }

    // 从默认配置开始
    const defaultIndex = this.configs.findIndex(config => 
      config.title === this.defaultTitle && config.type === 'normal'
    );
    
    // 如果默认配置不是 normal 类型，使用第一个 normal 类型的配置
    this.currentConfigIndex = defaultIndex !== -1 ? defaultIndex : normalIndexes[0];

    try {
      console.log('开始执行 API 调用...');
      const { client, model } = this.getCurrentClient();
      return await operation(client, model);
    } catch (error) {
      console.error('API 调用失败:', error);
      
      // 在 normal 类型的配置中切换
      const currentNormalIndex = normalIndexes.indexOf(this.currentConfigIndex);
      if (currentNormalIndex < normalIndexes.length - 1) {
        this.currentConfigIndex = normalIndexes[currentNormalIndex + 1];
        console.log(`切换到备用配置 ${this.configs[this.currentConfigIndex].title}`);
        return this.executeWithFallback(operation);
      }
      
      console.log('重置配置到初始状态');
      this.currentConfigIndex = defaultIndex !== -1 ? defaultIndex : normalIndexes[0];
      throw error;
    }
  }

  // 新增方法：专门用于 reasoner 类型的调用
  public async executeWithReasoner<T>(
    title: string,
    operation: (client: OpenAI | GoogleGenerativeAI, model: string) => Promise<T>
  ): Promise<T> {
    const config = this.configs.find(c => c.title === title);
    if (!config || config.type !== 'reasoner') {
      throw new Error(`No reasoner configuration found for title: ${title}`);
    }

    const client = this.clients.get(title);
    if (!client) {
      throw new Error(`Client not found for title: ${title}`);
    }

    try {
      return await operation(client.client, client.model);
    } catch (error) {
      console.error(`Reasoner API call failed for ${title}:`, error);
      throw error;
    }
  }

  public getReasonerConfigs(): ApiConfig[] {
    return this.configs.filter(config => config.type === 'reasoner');
  }

  // 获取所有 normal 类型的配置
  public getNormalConfigs(): ApiConfig[] {
    return this.configs.filter(config => config.type === 'normal');
  }

  // 使用指定模型执行操作
  public async executeWithModel<T>(
    title: string,
    operation: (client: OpenAI | GoogleGenerativeAI, model: string) => Promise<T>
  ): Promise<T> {
    const config = this.configs.find(c => c.title === title);
    if (!config) {
      throw new Error(`Configuration not found for title: ${title}`);
    }

    const client = this.clients.get(title);
    if (!client) {
      throw new Error(`Client not found for title: ${title}`);
    }

    try {
      return await operation(client.client, client.model);
    } catch (error) {
      console.error(`API call failed for ${title}:`, error);
      throw error;
    }
  }

  public async chat(messages: any[], options: any = {}) {
    const currentConfig = this.configs[this.currentConfigIndex];
    const clientInfo = this.clients.get(currentConfig.title);
    
    if (!clientInfo) {
      throw new Error(`No client found for ${currentConfig.title}`);
    }

    if (clientInfo.compatibleMode === 'gemini') {
      const genAI = clientInfo.client as GoogleGenerativeAI;
      const model = genAI.getGenerativeModel({ model: clientInfo.model });
      
      // Convert OpenAI messages format to Gemini format
      const geminiHistory = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: geminiHistory.slice(0, -1), // exclude the last message
        generationConfig: {
          maxOutputTokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
        }
      });

      const result = await chat.sendMessage(geminiHistory[geminiHistory.length - 1].parts[0].text);
      const response = await result.response;
      
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: response.text()
          }
        }]
      };
    } else {
      // Original OpenAI compatible API call
      const client = clientInfo.client as OpenAI;
      return await client.chat.completions.create({
        model: clientInfo.model,
        messages,
        ...options
      });
    }
  }
}

// 修复顶层 await 问题，改用立即执行的异步函数
let openAIClient: OpenAIClientManager;
(async () => {
  console.log('开始创建 OpenAIClientManager 单例...');
  openAIClient = await OpenAIClientManager.getInstance();
  console.log('OpenAIClientManager 单例创建完成');
})();

export { openAIClient };

// 创建一个获取实例的函数，而不是直接初始化
export async function getOpenAIClient() {
  return await OpenAIClientManager.getInstance();
} 