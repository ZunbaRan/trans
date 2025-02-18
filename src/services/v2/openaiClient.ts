import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import path from 'path';

interface ApiConfig {
  title: string;
  apiKey: string;
  baseURL: string;
  model: string;
  type: 'normal' | 'reasoner';
}

interface OpenAIConfig {
  default: string;
  configs: ApiConfig[];
}

export class OpenAIClientManager {
  private static instance: OpenAIClientManager;
  private configs: ApiConfig[] = [];
  private clients: Map<string, { client: OpenAI; model: string; type: 'normal' | 'reasoner' }> = new Map();
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
    await this.loadConfigs();
    this.initializeClients();
    // 设置初始配置为默认配置
    this.currentConfigIndex = this.configs.findIndex(config => config.title === this.defaultTitle);
    if (this.currentConfigIndex === -1) {
      this.currentConfigIndex = 0;
      console.warn(`默认配置 ${this.defaultTitle} 未找到，使用第一个配置`);
    }
  }

  private async loadConfigs() {
    console.log('开始加载 API 配置...');
    try {
      // 读取配置文件
      const configPath = path.join(process.cwd(), 'src/config/openai.config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config: OpenAIConfig = JSON.parse(configData);

      // 设置默认配置
      this.defaultTitle = config.default;
      this.configs = config.configs.map(conf => ({
        ...conf,
        apiKey: process.env[conf.apiKey] || conf.apiKey // 支持环境变量
      }));

      console.log(`已加载 ${this.configs.length} 个配置`);
      this.configs.forEach(conf => {
        console.log(`加载配置 ${conf.title}:`, {
          ...conf,
          apiKey: `${conf.apiKey.slice(0, 8)}...${conf.apiKey.slice(-4)}`
        });
      });

    } catch (error) {
      console.error('没有找到有效的 OpenAI 配置');
      throw new Error('No valid OpenAI configurations found');
    }
  }


  private initializeClients() {
    this.configs.forEach(config => {
      this.clients.set(config.title, {
        client: new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL
        }),
        model: config.model,
        type: config.type
      });
    });
  }

  public getCurrentClient(): { client: OpenAI; model: string; type: 'normal' | 'reasoner' } {
    const config = this.configs[this.currentConfigIndex];
    const client = this.clients.get(config.title);
    if (!client) {
      throw new Error(`Client not found for config: ${config.title}`);
    }
    return client;
  }

  public getClientByTitle(title: string): { client: OpenAI; model: string; type: 'normal' | 'reasoner' } {
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
    operation: (client: OpenAI, model: string) => Promise<T>
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
    operation: (client: OpenAI, model: string) => Promise<T>
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