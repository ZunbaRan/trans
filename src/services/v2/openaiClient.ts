import { OpenAI } from 'openai';

interface ApiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class OpenAIClientManager {
  private static instance: OpenAIClientManager;
  private configs: ApiConfig[] = [];
  private currentConfigIndex = 0;

  private constructor() {
    console.log('OpenAIClientManager 开始初始化...');
    this.loadConfigs();
  }

  public static getInstance(): OpenAIClientManager {
    console.log('OpenAIClientManager.getInstance() 被调用');
    if (!OpenAIClientManager.instance) {
      console.log('创建新的 OpenAIClientManager 实例');
      OpenAIClientManager.instance = new OpenAIClientManager();
    }
    return OpenAIClientManager.instance;
  }

  private loadConfigs() {
    console.log('开始加载 API 配置...');
    
    // 加载主要配置
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL && process.env.OPENAI_MODEL) {
      const mainConfig = {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL
      };
      console.log('加载主要配置:', {
        ...mainConfig,
        apiKey: `${mainConfig.apiKey.slice(0, 8)}...${mainConfig.apiKey.slice(-4)}`
      });
      this.configs.push(mainConfig);
    }

    // 加载备用配置
    if (process.env.OPENAI_API_KEY_BACKUP && process.env.OPENAI_BASE_URL_BACKUP && process.env.OPENAI_MODEL_BACKUP) {
      const backupConfig = {
        apiKey: process.env.OPENAI_API_KEY_BACKUP,
        baseURL: process.env.OPENAI_BASE_URL_BACKUP,
        model: process.env.OPENAI_MODEL_BACKUP
      };
      console.log('加载备用配置:', {
        ...backupConfig,
        apiKey: `${backupConfig.apiKey.slice(0, 8)}...${backupConfig.apiKey.slice(-4)}`
      });
      this.configs.push(backupConfig);
    }

    console.log(`已加载 ${this.configs.length} 个配置`);

    if (this.configs.length === 0) {
      console.error('没有找到有效的 OpenAI 配置');
      throw new Error('No valid OpenAI configurations found');
    }
  }

  public getCurrentClient(): { client: OpenAI; model: string } {
    const config = this.configs[this.currentConfigIndex];
    console.log(`获取当前客户端配置 (索引: ${this.currentConfigIndex}):`, {
      ...config,
      apiKey: `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}`
    });
    return {
      client: new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL
      }),
      model: config.model
    };
  }

  public async executeWithFallback<T>(
    operation: (client: OpenAI, model: string) => Promise<T>
  ): Promise<T> {
    try {
      console.log('开始执行 API 调用...');
      const { client, model } = this.getCurrentClient();
      return await operation(client, model);
    } catch (error) {
      console.error('API 调用失败:', error);
      
      if (this.switchToNextConfig()) {
        console.log('切换到备用配置重试...');
        return this.executeWithFallback(operation);
      }
      
      console.log('重置配置到初始状态');
      this.resetToFirstConfig();
      throw error;
    }
  }

  private switchToNextConfig(): boolean {
    if (this.currentConfigIndex < this.configs.length - 1) {
      this.currentConfigIndex++;
      console.log(`切换到配置 ${this.currentConfigIndex + 1}`);
      return true;
    }
    console.log('没有更多可用配置');
    return false;
  }

  private resetToFirstConfig(): void {
    this.currentConfigIndex = 0;
    console.log('重置为第一个配置');
  }
}

console.log('开始创建 OpenAIClientManager 单例...');
export const openAIClient = OpenAIClientManager.getInstance();
console.log('OpenAIClientManager 单例创建完成'); 