/**
 * Deep Research 核心实现
 * 这个模块实现了一个结合大模型推理和联网搜索的深度研究工具
 */

import axios from 'axios';
import { 
  ArkChatRequest, 
  ArkChatResponse, 
  ArkChatCompletionChunk, 
  ArkMessage 
} from './types';
import { SearchEngine, SearchResult } from '../search_engine';
import { VolcBotSearchEngine } from '../search_engine';
import { 
  DEFAULT_PLANNING_PROMPT, 
  DEFAULT_SUMMARY_PROMPT 
} from './prompt';
import { 
  getCurrentDate, 
  castContentToReasoningContent, 
  genMetadataChunk 
} from './utils';
import { createModuleLogger } from '../utils/logger';

// 创建模块日志记录器
const logger = createModuleLogger('deep-research');

/**
 * 搜索结果摘要类
 * 用于存储和管理搜索结果
 */
export class ResultsSummary {
  // 存储查询词与搜索结果的映射关系
  private refDict: Record<string, SearchResult[]> = {};

  /**
   * 添加搜索结果
   * @param query 查询关键词
   * @param results 搜索结果数组
   */
  addResult(query: string, results: SearchResult[]): void {
    // 如果该查询词没有结果，直接添加
    if (!this.refDict[query]) {
      this.refDict[query] = [...results];
    } else {
      // 否则，将新结果添加到现有结果中
      const extendedReferences = this.refDict[query] || [];
      this.refDict[query] = [...extendedReferences, ...results];
    }
  }

  /**
   * 将所有搜索结果转换为纯文本格式
   * @returns 格式化的搜索结果文本
   */
  toPlaintext(): string {
    let output = "";

    // 遍历所有查询词和结果
    for (const [key, value] of Object.entries(this.refDict)) {
      // 添加查询词标题
      output += `\n【查询 "${key}" 得到的相关资料】`;
      // 添加所有搜索结果的摘要内容
      output += value.map(v => v.summaryContent || '').join('\n');
    }

    return output;
  }
}

/**
 * 额外配置接口
 */
export interface ExtraConfig {
  // 最大规划轮数
  maxPlanningRounds: number;
  // 最大搜索词数
  maxSearchWords: number;
  // 规划模板
  planningTemplate: string;
  // 总结模板
  summaryTemplate: string;
}

/**
 * 模板渲染函数
 * @param template 模板字符串
 * @param variables 变量映射
 * @returns 渲染后的字符串
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  // 替换所有变量
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return result;
}

/**
 * Deep Research 核心类
 * 实现了深度研究的主要业务逻辑
 */
export class DeepResearch {
  // 搜索引擎实例
  private searchEngine: SearchEngine;
  // 规划阶段使用的模型ID
  private planningEndpointId: string;
  // 总结阶段使用的模型ID
  private summaryEndpointId: string;
  // 额外配置
  private extraConfig: ExtraConfig;

  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(
    options: {
      searchEngine?: SearchEngine;
      planningEndpointId?: string;
      summaryEndpointId?: string;
      extraConfig?: Partial<ExtraConfig>;
    } = {}
  ) {
    // 初始化搜索引擎，默认使用VolcBotSearchEngine
    this.searchEngine = options.searchEngine || new VolcBotSearchEngine(
      process.env.SEARCH_BOT_ID || '',
      process.env.ARK_API_KEY
    );
    // 初始化规划模型ID
    this.planningEndpointId = options.planningEndpointId || process.env.REASONING_MODEL || '';
    // 初始化总结模型ID
    this.summaryEndpointId = options.summaryEndpointId || process.env.REASONING_MODEL || '';
    // 初始化配置，使用默认值和传入的值合并
    this.extraConfig = {
      maxPlanningRounds: 5,
      maxSearchWords: 5,
      planningTemplate: DEFAULT_PLANNING_PROMPT,
      summaryTemplate: DEFAULT_SUMMARY_PROMPT,
      ...options.extraConfig
    };
  }

  /**
   * 执行深度研究
   * 业务流程：
   * 1. 执行规划阶段，收集搜索结果
   * 2. 将规划阶段的推理内容添加到请求中
   * 3. 执行总结阶段，生成最终回答
   * 4. 返回包含推理内容和总结内容的响应
   */
  async runDeepResearch(request: ArkChatRequest, question: string): Promise<ArkChatResponse> {
    // 创建搜索结果摘要实例
    const references = new ResultsSummary();
    // 用于存储规划阶段的推理内容
    let bufferedReasoningContent = "";

    // 1. 执行规划阶段
    for await (const reasoningChunk of this.streamPlanning(request, question, references)) {
      // 收集推理内容
      if (reasoningChunk.choices[0].delta.reasoning_content) {
        bufferedReasoningContent += reasoningChunk.choices[0].delta.reasoning_content;
      }
    }

    // 2. 执行总结阶段
    // 将推理内容作为助手消息添加，帮助总结
    request.messages.push({
      role: 'assistant',
      content: bufferedReasoningContent
    });

    // 调用总结方法
    const resp = await this.runSummary(request, question, references);
    
    // 添加推理内容到响应中
    if (resp.choices[0].message) {
      resp.choices[0].message.reasoning_content = bufferedReasoningContent + 
        (resp.choices[0].message.reasoning_content || '');
    }
    
    return resp;
  }

  /**
   * 流式执行深度研究
   * 业务流程：
   * 1. 流式执行规划阶段，收集搜索结果并输出流
   * 2. 将规划阶段的推理内容添加到请求中
   * 3. 流式执行总结阶段，生成最终回答并输出流
   */
  async *streamDeepResearch(
    request: ArkChatRequest, 
    question: string
  ): AsyncGenerator<ArkChatCompletionChunk> {
    // 创建搜索结果摘要实例
    const references = new ResultsSummary();
    // 用于存储规划阶段的推理内容
    let bufferedReasoningContent = "";

    // 1. 流式执行规划阶段
    for await (const reasoningChunk of this.streamPlanning(request, question, references)) {
      // 收集推理内容
      if (reasoningChunk.choices[0].delta.reasoning_content) {
        bufferedReasoningContent += reasoningChunk.choices[0].delta.reasoning_content;
      }
      // 输出流
      yield reasoningChunk;
    }

    // 2. 流式执行总结阶段
    // 将推理内容作为助手消息添加，帮助总结
    request.messages.push({
      role: 'assistant',
      content: bufferedReasoningContent
    });

    // 流式执行总结并输出
    for await (const summaryChunk of this.streamSummary(request, question, references)) {
      yield summaryChunk;
    }
  }

  /**
   * 流式执行规划阶段
   * 业务流程：
   * 1. 循环执行规划，直到达到最大轮数或模型认为不需要继续搜索
   * 2. 每轮规划中，调用LLM生成搜索关键词
   * 3. 使用搜索引擎获取搜索结果
   * 4. 将搜索结果添加到参考资料中
   * 5. 输出流式响应，包含规划过程和搜索状态
   */
  async *streamPlanning(
    request: ArkChatRequest,
    question: string,
    references: ResultsSummary
  ): AsyncGenerator<ArkChatCompletionChunk> {
    // 规划轮数计数
    let plannedRounds = 1;
    
    // 循环执行规划，直到达到最大轮数
    while (plannedRounds <= this.extraConfig.maxPlanningRounds) {
      plannedRounds++;

      // 构建提示词，包含问题、已有参考资料等
      const prompt = renderTemplate(this.extraConfig.planningTemplate, {
        reference: references.toPlaintext(),
        question,
        max_search_words: this.extraConfig.maxSearchWords,
        meta_info: `当前时间：${getCurrentDate()}`
      });

      // 调用LLM，流式获取规划结果
      const stream = await this.streamLLM(
        this.planningEndpointId,
        [...request.messages, { role: 'user', content: prompt }]
      );

      // 存储规划结果
      let planningResult = "";

      // 处理流式响应
      for await (const chunk of stream) {
        if (chunk.choices[0].delta.reasoning_content) {
          // 如果已经是reasoning_content，直接输出
          yield chunk;
        } else if (chunk.choices[0].delta.content) {
          // 如果是content，转换为reasoning_content后输出
          planningResult += chunk.choices[0].delta.content;
          yield castContentToReasoningContent(chunk);
        }
      }

      // 记录规划结果
      logger.info(`got planning_result: ${planningResult}`);

      // 检查是否需要继续搜索
      const newQueries = this.checkQuery(planningResult);
      if (!newQueries) {
        // 如果不需要继续搜索，生成完成状态并退出循环
        yield genMetadataChunk({
          'search_state': 'finished'
        });
        logger.info("planning finished");
        break;
      } else {
        // 如果需要继续搜索，记录搜索关键词
        logger.info(`searching: ${newQueries}`);
        // 生成搜索状态
        yield genMetadataChunk({
          'search_rounds': plannedRounds,
          'search_state': 'searching',
          'search_keywords': newQueries
        });
        
        // 执行搜索
        const searchResults = await this.searchEngine.asearch(newQueries);
        
        // 记录搜索结果
        logger.info(`search result: ${JSON.stringify(searchResults)}`);
        
        // 生成搜索完成状态
        yield genMetadataChunk({
          'search_rounds': plannedRounds,
          'search_state': 'searched',
          'search_keywords': newQueries,
          'search_results': searchResults
        });
        
        // 将搜索结果添加到参考资料中
        for (const searchResult of searchResults) {
          references.addResult(searchResult.query, [searchResult]);
        }
      }
    }
  }

  /**
   * 执行总结阶段
   * 业务流程：
   * 1. 构建总结提示词，包含问题和所有参考资料
   * 2. 调用LLM生成总结回答
   * 3. 返回总结响应
   */
  async runSummary(
    request: ArkChatRequest,
    question: string,
    references: ResultsSummary
  ): Promise<ArkChatResponse> {
    // 构建提示词
    const prompt = renderTemplate(this.extraConfig.summaryTemplate, {
      reference: references.toPlaintext(),
      question,
      meta_info: `当前时间：${getCurrentDate()}`
    });

    // 调用LLM生成总结
    return this.callLLM(
      this.summaryEndpointId,
      [...request.messages, { role: 'user', content: prompt }]
    );
  }

  /**
   * 流式执行总结阶段
   * 业务流程：
   * 1. 构建总结提示词，包含问题和所有参考资料
   * 2. 流式调用LLM生成总结回答
   * 3. 输出流式响应
   */
  async *streamSummary(
    request: ArkChatRequest,
    question: string,
    references: ResultsSummary
  ): AsyncGenerator<ArkChatCompletionChunk> {
    // 构建提示词
    const prompt = renderTemplate(this.extraConfig.summaryTemplate, {
      reference: references.toPlaintext(),
      question,
      meta_info: `当前时间：${getCurrentDate()}`
    });

    // 记录联网资料
    logger.info("----- 联网资料 -----");
    logger.info(`${references.toPlaintext()}`);

    // 流式调用LLM
    const stream = await this.streamLLM(
      this.summaryEndpointId,
      [...request.messages, { role: 'user', content: prompt }]
    );

    // 输出流式响应
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * 检查是否需要继续查询
   * @param output 规划输出
   * @returns 搜索关键词数组或null（不需要继续搜索）
   */
  private checkQuery(output: string): string[] | null {
    // 如果包含"无需"，表示不需要继续搜索
    if (output.includes('无需')) {
      return null;
    }
    // 否则，按分号分割并去除空格，返回搜索关键词数组
    return output.split(';').map(o => o.trim());
  }

  /**
   * 调用LLM
   * @param model 模型ID
   * @param messages 消息数组
   * @returns LLM响应
   */
  private async callLLM(
    model: string,
    messages: ArkMessage[]
  ): Promise<ArkChatResponse> {
    try {
      // 使用OpenAI兼容格式的API
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model,
          messages,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ARK_API_KEY}`
          }
        }
      );
      
      // 返回响应数据
      return response.data;
    } catch (error) {
      // 记录错误并抛出
      logger.error('LLM API error:', error);
      throw error;
    }
  }

  /**
   * 流式调用LLM
   * @param model 模型ID
   * @param messages 消息数组
   * @returns 异步生成器，生成LLM流式响应
   */
  private async streamLLM(
    model: string,
    messages: ArkMessage[]
  ): Promise<AsyncGenerator<ArkChatCompletionChunk>> {
    try {
      // 使用OpenAI兼容格式的API，设置stream=true
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model,
          messages,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ARK_API_KEY}`
          },
          responseType: 'stream'
        }
      );

      // 获取响应流
      const stream = response.data;
      
      // 解析SSE流
      return this.parseSSEStream(stream);
    } catch (error) {
      // 记录错误并抛出
      logger.error('LLM API streaming error:', error);
      throw error;
    }
  }

  /**
   * 解析SSE流
   * @param stream 响应流
   * @returns 异步生成器，生成解析后的响应块
   */
  private async *parseSSEStream(stream: any): AsyncGenerator<ArkChatCompletionChunk> {
    // 缓冲区，用于存储不完整的行
    let buffer = '';
    
    // 遍历流中的每个块
    for await (const chunk of stream) {
      // 将块转换为字符串并添加到缓冲区
      buffer += chunk.toString();
      
      // 按换行符分割缓冲区
      const lines = buffer.split('\n');
      // 最后一行可能不完整，保留到下一次处理
      buffer = lines.pop() || '';
      
      // 处理每一行
      for (const line of lines) {
        // 检查是否是SSE数据行
        if (line.startsWith('data: ')) {
          // 提取数据部分
          const data = line.slice(6);
          
          // 检查是否是结束标记
          if (data === '[DONE]') {
            return;
          }
          
          try {
            // 解析JSON数据
            const parsed = JSON.parse(data) as ArkChatCompletionChunk;
            // 输出解析后的数据
            yield parsed;
          } catch (e) {
            // 记录解析错误
            logger.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  }
} 