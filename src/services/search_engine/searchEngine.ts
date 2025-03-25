/**
 * 搜索引擎基础接口和类型定义
 */

/**
 * 单个搜索引用结果
 */
export interface SearchReference {
  site?: string;
  title?: string;
  url?: string;
  content?: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  // 查询关键词
  query: string;
  // 搜索结果摘要内容
  summaryContent?: string;
  // 原始搜索引用结果
  searchReferences?: SearchReference[];
}

/**
 * 搜索引擎抽象接口
 */
export abstract class SearchEngine {
  /**
   * 同步搜索方法
   * @param queries 查询关键词列表
   */
  abstract search(queries: string[]): Promise<SearchResult[]>;

  /**
   * 异步搜索方法
   * @param queries 查询关键词列表
   */
  abstract async asearch(queries: string[]): Promise<SearchResult[]>;
} 