/**
 * 火山方舟零代码联网应用搜索引擎实现
 */

import axios from 'axios';
import { SearchEngine, SearchResult, SearchReference } from './searchEngine';

interface BotChatMessage {
  role: string;
  content: string;
}

interface BotChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface BotReference {
  site_name?: string;
  url?: string;
  summary?: string;
  title?: string;
}

interface BotChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: BotChatChoice[];
  references?: BotReference[];
}

export class VolcBotSearchEngine extends SearchEngine {
  private botId: string;
  private apiKey?: string;
  private baseUrl: string = 'https://ark.cn-beijing.volces.com/api/v3/bots';

  constructor(
    botId: string,
    apiKey?: string,
    baseUrl?: string
  ) {
    super();
    this.botId = botId;
    this.apiKey = apiKey;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
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
    const promises = queries.map(query => this.singleSearch(query));
    return Promise.all(promises);
  }

  /**
   * 单个查询搜索
   * @param query 查询关键词
   */
  private async singleSearch(query: string): Promise<SearchResult> {
    try {
      const response = await this.runBotSearch(query);
      return this.formatResult(response, query);
    } catch (error) {
      console.error('VolcBot search error:', error);
      return {
        query,
        summaryContent: `搜索失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 执行机器人搜索
   * @param query 查询关键词
   */
  private async runBotSearch(query: string): Promise<BotChatCompletion> {
    const url = `${this.baseUrl}/${this.botId}/chat/completions`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    const data = {
      messages: [
        {
          role: 'user',
          content: query
        }
      ],
      stream: false
    };
    
    const response = await axios.post(url, data, { headers });
    return response.data;
  }

  /**
   * 格式化搜索结果
   * @param response 机器人搜索响应
   * @param query 查询关键词
   */
  private formatResult(response: BotChatCompletion, query: string): SearchResult {
    const searchReferences: SearchReference[] = [];
    
    if (response.references) {
      response.references.forEach(ref => {
        searchReferences.push({
          site: ref.site_name,
          url: ref.url,
          content: ref.summary,
          title: ref.title
        });
      });
    }
    
    return {
      query,
      summaryContent: response.choices[0]?.message.content,
      searchReferences
    };
  }
} 