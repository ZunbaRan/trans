import * as fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

export interface ModelConfig {
  title: string;
  apiKey: string;
  baseURL: string;
  model: string;
  type: 'normal' | 'reasoner';
  compatibleMode: 'openai' | 'gemini' | string;
}

export interface ConfigFile {
  default: string;
  configs: ModelConfig[];
}

export class ConfigLoader {
  private static configPath = path.join(process.cwd(), 'src/config/openai.config.json');
  private static configCache: ConfigFile | null = null;
  private static lastLoadTime: number = 0;
  private static cacheValidityPeriod = 60000; // 缓存有效期：1分钟

  /**
   * 加载完整配置文件
   */
  public static async loadFullConfig(): Promise<ConfigFile> {
    const currentTime = Date.now();
    
    // 如果缓存有效，直接返回缓存
    if (
      this.configCache && 
      currentTime - this.lastLoadTime < this.cacheValidityPeriod
    ) {
      return this.configCache;
    }
    
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.configCache = JSON.parse(configData);
      this.lastLoadTime = currentTime;
      return this.configCache;
    } catch (error) {
      logger.error('加载配置文件失败:', error);
      throw new Error('Failed to load configuration file');
    }
  }

  /**
   * 根据标题获取特定配置
   * @param configTitle 配置标题
   * @param fallbackValues 默认值（如果找不到配置）
   */
  public static async getConfig<T extends Partial<ModelConfig>>(
    configTitle: string,
    fallbackValues: T
  ): Promise<ModelConfig & T> {
    try {
      const config = await this.loadFullConfig();
      
      // 查找指定标题的配置
      const targetConfig = config.configs.find(c => c.title === configTitle);
      
      if (!targetConfig) {
        logger.warn(`未找到标题为 "${configTitle}" 的配置，使用默认值`);
        return { ...fallbackValues } as ModelConfig & T;
      }
      
      logger.info(`已加载 "${configTitle}" 配置`);
      return { ...targetConfig } as ModelConfig & T;
    } catch (error) {
      logger.error('获取配置失败:', error);
      return { ...fallbackValues } as ModelConfig & T;
    }
  }

  /**
   * 获取默认配置
   * @param fallbackTitle 如果没有默认配置，使用此标题
   */
  public static async getDefaultConfig(fallbackTitle?: string): Promise<ModelConfig | null> {
    try {
      const config = await this.loadFullConfig();
      const defaultTitle = config.default;
      
      if (!defaultTitle && !fallbackTitle) {
        logger.warn('未找到默认配置，且未提供备选标题');
        return null;
      }
      
      const titleToUse = defaultTitle || fallbackTitle;
      const targetConfig = config.configs.find(c => c.title === titleToUse);
      
      if (!targetConfig) {
        logger.warn(`未找到标题为 "${titleToUse}" 的配置`);
        return null;
      }
      
      return targetConfig;
    } catch (error) {
      logger.error('获取默认配置失败:', error);
      return null;
    }
  }

  /**
   * 获取指定类型的所有配置
   * @param type 配置类型
   */
  public static async getConfigsByType(type: 'normal' | 'reasoner'): Promise<ModelConfig[]> {
    try {
      const config = await this.loadFullConfig();
      return config.configs.filter(c => c.type === type);
    } catch (error) {
      logger.error(`获取 ${type} 类型配置失败:`, error);
      return [];
    }
  }
} 