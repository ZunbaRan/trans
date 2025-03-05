import { tavily, TavilyClient, TavilySearchOptions, TavilySearchResponse } from '@tavily/core';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import path from 'path';
import axios from 'axios';

interface TavilyConfig {
  apiKey: string;
}

interface SearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeRawContent?: boolean;
  includeImages?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  includeAnswer?: boolean;
}

export class TavilySearchUtil {
  private apiKey: string = '';
  private tavilyClient: TavilyClient | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * 加载 Tavily 配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'src/config/tavily.yml');
      const configFile = await fs.readFile(configPath, 'utf8');
      const config = yaml.load(configFile) as TavilyConfig;
      
      if (!config || !config.apiKey) {
        throw new Error('Tavily 配置文件格式不正确或 API Key 缺失');
      }
      
      this.apiKey = config.apiKey;
      this.tavilyClient = tavily({ apiKey: this.apiKey });
      
      console.log('Tavily 配置加载成功');
    } catch (error) {
      console.error('加载 Tavily 配置失败:', error);
      throw new Error('无法加载 Tavily 配置');
    }
  }

  /**
   * 执行 Tavily 搜索
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns 搜索结果
   */
  public async search(query: string, options?: Partial<SearchOptions>): Promise<TavilySearchResponse> {
    try {
      // 确保客户端已初始化
      if (!this.tavilyClient) {
        await this.loadConfig();
      }
      
      // 构建搜索参数
      const searchParams: TavilySearchOptions = {
        ...options
      };
      
      // 执行搜索
      if (!this.tavilyClient) {
        throw new Error('Tavily 客户端初始化失败');
      }
      
      const response = await this.tavilyClient.search(query, searchParams);
      
      return response;
    } catch (error) {
      console.error('Tavily 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 获取搜索结果文本
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns 搜索结果文本
   */
  public async getSearchResultsText(query: string, options?: Partial<SearchOptions>): Promise<TavilySearchResponse> {
    const response = await this.search(query, options);
    
    let resultsText = '';
    
    // 如果有生成的答案，添加到结果中
    if (response.answer) {
      resultsText += `答案: ${response.answer}\n\n`;
    }
    
    // 添加搜索结果
    if (response.results && response.results.length > 0) {
      resultsText += '搜索结果:\n\n';
      
      response.results.forEach((result, index) => {
        resultsText += `[${index + 1}] ${result.title}\n`;
        resultsText += `来源: ${result.url}\n`;
        resultsText += `${result.content}\n\n`;
      });
    } else {
      resultsText += '没有找到相关搜索结果。\n';
    }
    
    return response;
  }

  public async basicSearchWithAnswer(query: string): Promise<TavilySearchResponse> {
    return this.getSearchResultsText(query, { searchDepth: 'basic', includeAnswer: true });
  }

  public async advancedSearchWithAnswer(query: string): Promise<TavilySearchResponse> {
    return this.getSearchResultsText(query, { searchDepth: 'advanced', includeAnswer: true });
  }

  /**
   * 简单搜索（基本深度）
   * @param query 搜索查询
   * @returns 搜索结果
   */
  public async basicSearch(query: string): Promise<TavilySearchResponse> {
    return this.search(query, { searchDepth: 'basic' });
  }

  /**
   * 高级搜索（高级深度）
   * @param query 搜索查询
   * @returns 搜索结果
   */
  public async advancedSearch(query: string): Promise<TavilySearchResponse> {
    return this.search(query, { searchDepth: 'advanced' });
  }

  /**
   * 从 URL 提取内容
   * @param urls 单个 URL 或 URL 数组
   * @param options 提取选项
   * @returns 提取的内容
   */
  public async extract(
    urls: string | string[],
    options?: {
      includeImages?: boolean;
      extractDepth?: 'basic' | 'advanced';
    }
  ): Promise<{
    results: Array<{
      url: string;
      raw_content: string;
      images: Array<any>;
    }>;
    failed_results: Array<string>;
    response_time: number;
  }> {
    try {
      // 确保客户端已初始化
      if (!this.tavilyClient) {
        await this.loadConfig();
      }
      
      if (!this.tavilyClient) {
        throw new Error('Tavily 客户端初始化失败');
      }
      
      // urls 截取前5个
      const urlsArray = Array.isArray(urls) ? urls.slice(0, 5) : [urls].slice(0, 5);
      
      // 构建请求参数
      const extractParams = {
        urls: urlsArray,
        include_images: options?.includeImages || false,
        extract_depth: options?.extractDepth || 'basic'
      };
      
      console.log('提取内容参数:', extractParams);
      
      // 调用 Tavily API 的 extract 端点
      const response = await axios.post(
        'https://api.tavily.com/extract',
        extractParams,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('提取内容响应:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Tavily 内容提取失败:', error);
      throw error;
    }
  }

  /**
   * 搜索并提取内容
   * @param query 搜索查询
   * @param maxUrls 最大提取的 URL 数量
   * @param options 搜索和提取选项
   * @returns 搜索结果和提取的内容
   */
  public async searchAndExtract(
    query: string,
    maxUrls: number = 3,
    options?: {
      searchDepth?: 'basic' | 'advanced';
      includeAnswer?: boolean;
      extractDepth?: 'basic' | 'advanced';
      includeImages?: boolean;
    }
  ): Promise<{
    searchResponse: TavilySearchResponse;
    extractedContents: {
      results: Array<{
        url: string;
        raw_content: string;
        images: Array<any>;
      }>;
      failed_results: Array<string>;
      response_time: number;
    };
  }> {
    try {
      // 执行搜索
      const searchResponse = await this.search(query, {
        searchDepth: options?.searchDepth || 'basic',
        includeAnswer: options?.includeAnswer || false
      });
      
      // 如果没有结果，直接返回
      if (!searchResponse.results || searchResponse.results.length === 0) {
        return {
          searchResponse,
          extractedContents: {
            results: [],
            failed_results: [],
            response_time: 0
          }
        };
      }
      
      // 获取前 N 个 URL
      const urls = searchResponse.results
        .slice(0, maxUrls)
        .map(result => result.url);
      
      console.log('准备提取内容的 URL:', urls);
      
      // 提取内容
      const extractedContents = await this.extract(urls, {
        extractDepth: options?.extractDepth || 'basic',
        includeImages: options?.includeImages || false
      });
      
      return {
        searchResponse,
        extractedContents
      };
    } catch (error) {
      console.error('搜索并提取内容失败:', error);
      throw error;
    }
  }
}

// 导出单例
export const tavilySearchUtil = new TavilySearchUtil(); 