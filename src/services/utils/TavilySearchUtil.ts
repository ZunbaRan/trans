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
   * 批量提取网页内容
   * @param urls 要提取的URL数组或单个URL
   * @param options 提取选项
   * @param targetCount 目标成功提取的数量，默认为5
   * @returns 提取结果
   */
  public async extract(
    urls: string | string[],
    options?: {
      includeImages?: boolean;
      extractDepth?: 'basic' | 'advanced';
    },
    targetCount: number = 5
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

      // 将单个URL转换为数组并创建一个副本
      const urlArray = Array.isArray(urls) ? [...urls] : [urls];
      let allResults: Array<{
        url: string;
        raw_content: string;
        images: Array<any>;
      }> = [];
      let allFailedResults: Array<string> = [];
      let totalResponseTime = 0;

      // 持续处理直到达到目标数量或没有更多URL可处理
      while (allResults.length < targetCount && urlArray.length > 0) {
        // 计算本次需要处理的URL数量
        const remainingCount = targetCount - allResults.length;
        const batchSize = Math.min(remainingCount, 5, urlArray.length);
        
        // 取出当前批次的URL
        const currentBatch = urlArray.splice(0, batchSize);
        
        // 构建请求参数
        const extractParams = {
          urls: currentBatch,
          include_images: options?.includeImages || false,
          extract_depth: options?.extractDepth || 'basic'
        };
            
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
        
        // 更新结果
        allResults = [...allResults, ...response.data.results];
        allFailedResults = [...allFailedResults, ...response.data.failed_results];
        totalResponseTime += response.data.response_time;

        // 记录本次批次的处理结果
        console.log('批次处理结果:', {
          requested: currentBatch.length,
          succeeded: response.data.results.length,
          failed: response.data.failed_results.length,
          totalSucceeded: allResults.length,
          remaining: targetCount - allResults.length
        });
      }

      console.log('提取内容完成:', {
        totalResults: allResults.length,
        totalFailed: allFailedResults.length,
        totalResponseTime,
        remainingUrls: urlArray.length
      });
      
      return {
        results: allResults,
        failed_results: allFailedResults,
        response_time: totalResponseTime
      };
    } catch (error) {
      console.error('Tavily 内容提取失败:', error);
      throw error;
    }
  }

  /**
   * 搜索并提取内容
   * @param query 搜索查询
   * @param options 搜索和提取选项
   * @returns 搜索结果和提取的内容
   */
  public async searchAndExtract(
    query: string,
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
        searchDepth: options?.searchDepth || 'advanced',
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
      
      // 获取所有 URL
      const urls = searchResponse.results.map(result => result.url);
      
      console.log('准备提取内容的 URL:', urls);
      
      // 提取内容
      const extractedContents = await this.extract(urls, {
        extractDepth: options?.extractDepth || 'advanced',
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