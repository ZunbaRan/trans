/**
 * Tavily 搜索引擎实现
 */

import { SearchEngine, SearchResult } from './searchEngine';

type SearchDepth = 'basic' | 'advanced';
type Topic = 'general' | 'news';

interface TavilyResponse {
  results: Array<{
    title?: string;
    content?: string;
    url?: string;
  }>;
}

export class TavilySearchEngine extends SearchEngine {
  private apiKey: string;
  private searchDepth: SearchDepth;
  private topic: Topic;
  private days: number;
  private maxResults: number;
  private includeDomains?: string;
  private excludeDomains?: string;

  constructor(
    apiKey: string,
    options: {
      searchDepth?: SearchDepth;
      topic?: Topic;
      days?: number;
      maxResults?: number;
      includeDomains?: string;
      excludeDomains?: string;
    } = {}
  ) {
    super();
    this.apiKey = apiKey;
    this.searchDepth = options.searchDepth || 'basic';
    this.topic = options.topic || 'general';
    this.days = options.days || 3;
    this.maxResults = options.maxResults || 5;
    this.includeDomains = options.includeDomains;
    this.excludeDomains = options.excludeDomains;
  }

  /**
   * 同步搜索方法
   * @param queries 查询关键词列表
   */
  async search(queries: string[]): Promise<SearchResult[]> {
    return this.asearch(queries);
  }

  /**
   * 异步搜索方法
   * @param queries 查询关键词列表
   */
  async asearch(queries: string[]): Promise<SearchResult[]> {
    const promises = queries.map(query => this.searchSingle(query));
    return Promise.all(promises);
  }

  /**
   * 单个查询搜索
   * @param query 查询关键词
   */
  private async searchSingle(query: string): Promise<SearchResult> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query,
          search_depth: this.searchDepth,
          topic: this.topic,
          days: this.days,
          max_results: this.maxResults,
          include_domains: this.includeDomains,
          exclude_domains: this.excludeDomains
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      const tavilyResult: TavilyResponse = await response.json();
      
      return {
        query,
        summaryContent: this.formatResult(tavilyResult)
      };
    } catch (error) {
      console.error('Tavily search error:', error);
      return {
        query,
        summaryContent: `搜索失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 格式化搜索结果
   * @param tavilyResult Tavily API 返回结果
   */
  private formatResult(tavilyResult: TavilyResponse): string {
    const results = tavilyResult.results || [];
    let formatted = '';
    
    results.forEach((result, i) => {
      formatted += `参考资料${i + 1}: \n`;
      formatted += `标题: ${result.title || ''}\n`;
      formatted += `内容: ${result.content || ''}\n`;
      formatted += '\n';
    });
    
    return formatted;
  }
} 