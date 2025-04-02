import { OpenAI } from 'openai';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('kimi-search');

/**
 * Kimi 联网搜索客户端
 */
export class KimiWebSearch {
  private client: OpenAI;
  
  constructor(apiKey: string = 'sk-ABrFfNmYXHXzxfKRvTXddWKa8aIIOhcmajZtSMwpfKXMdVQd') {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.moonshot.cn/v1",
    });
  }

  /**
   * 执行联网搜索
   * @param query 搜索查询
   * @returns 搜索结果
   */
  async search(query: string): Promise<string> {
    const tools = [
      {
        "type": "builtin_function" as any,
        "function": {
          "name": "$web_search",
        },
      }
    ];

    const messages = [
      { 
        "role": "system", 
        "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。请提供准确、有帮助的回答。" 
      },
      { 
        "role": "user", 
        "content": query 
      }
    ];

    let finishReason = null;
    let finalContent = '';

    try {
      while (finishReason === null || finishReason === "tool_calls") {
        logger.info(`发送请求到 Kimi API，当前消息数: ${messages.length}`);
        
        const completion = await this.client.chat.completions.create({
          model: "moonshot-v1-auto",
          messages: messages as any,
          temperature: 0.3,
          tools: tools,
        });

        const choice = completion.choices[0];
        finishReason = choice.finish_reason;
        
        if (finishReason === "tool_calls") {
          // 添加助手消息到上下文
          messages.push(choice.message as any);
          
          // 处理工具调用
          for (const toolCall of choice.message.tool_calls || []) {
            const toolCallName = toolCall.function.name;
            const toolCallArguments = JSON.parse(toolCall.function.arguments);
            
            if (toolCallName === "$web_search") {
              logger.info(`执行 $web_search 搜索，参数: ${JSON.stringify(toolCallArguments)}`);
              
              // 对于 $web_search，我们只需要原样返回参数
              const toolResult = toolCallArguments;
              
              // 添加工具结果到上下文
              messages.push({
                "role": "tool" as const,
                "tool_call_id": toolCall.id,
                "name": toolCallName,
                "content": JSON.stringify(toolResult),
              } as any);
            }
          }
        } else {
          // 最终回答
          finalContent = choice.message.content || '';
          logger.info(`搜索完成，获得最终回答`);
        }
      }
      
      return finalContent;
    } catch (error) {
      logger.error('Kimi 联网搜索失败', error);
      throw new Error(`Kimi 联网搜索失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 流式执行联网搜索
   * @param query 搜索查询
   */
  async *streamSearch(query: string): AsyncGenerator<string> {
    const tools = [
      {
        "type": "builtin_function" as any,
        "function": {
          "name": "$web_search",
        },
      }
    ];

    const messages = [
      { 
        "role": "system", 
        "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。请提供准确、有帮助的回答。" 
      },
      { 
        "role": "user", 
        "content": query 
      }
    ];

    let finishReason = null;

    try {
      while (finishReason === null || finishReason === "tool_calls") {
        logger.info(`发送请求到 Kimi API，当前消息数: ${messages.length}`);
        
        // 第一次请求或工具调用时使用非流式请求
        if (finishReason === null || finishReason === "tool_calls") {
          const completion = await this.client.chat.completions.create({
            model: "moonshot-v1-auto",
            messages: messages as any,
            temperature: 0.3,
            tools: tools,
            stream: false,
          });

          const choice = completion.choices[0];
          finishReason = choice.finish_reason;
          
          if (finishReason === "tool_calls") {
            // 添加助手消息到上下文
            messages.push(choice.message as any);
            
            // 处理工具调用
            for (const toolCall of choice.message.tool_calls || []) {
              const toolCallName = toolCall.function.name;
              const toolCallArguments = JSON.parse(toolCall.function.arguments);
              
              if (toolCallName === "$web_search") {
                logger.info(`执行 $web_search 搜索，参数: ${JSON.stringify(toolCallArguments)}`);
                
                // 对于 $web_search，我们只需要原样返回参数
                const toolResult = toolCallArguments;
                
                // 添加工具结果到上下文
                messages.push({
                  "role": "tool" as const,
                  "tool_call_id": toolCall.id,
                  "name": toolCallName,
                  "content": JSON.stringify(toolResult),
                } as any);
              }
            }
          }
        } else {
          // 最终回答使用流式请求
          const stream = await this.client.chat.completions.create({
            model: "moonshot-v1-auto",
            messages: messages as any,
            temperature: 0.3,
            stream: true,
          });
          
          for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.content) {
              yield chunk.choices[0].delta.content;
            }
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Kimi 流式联网搜索失败', error);
      throw new Error(`Kimi 流式联网搜索失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const kimiWebSearch = new KimiWebSearch();

// 简单使用示例
async function demo() {
  try {
    const result = await kimiWebSearch.search("请搜索2024年最新的人工智能发展趋势");
    console.log("搜索结果:", result);
    
    // console.log("\n流式搜索示例:");
    // for await (const chunk of kimiWebSearch.streamSearch("请搜索量子计算的最新进展")) {
    //   process.stdout.write(chunk);
    // }
  } catch (error) {
    console.error("搜索失败:", error);
  }
}

// 如果直接运行此文件，则执行演示
if (require.main === module) {
  demo();
}
 

// {
//     "query": "帮我搜索10条社会痛点议题，时间限制为 2025年3月份, 我需要参考作为公众号文章的选题，包括但不限于：具有黑色幽默的社会事件；揭露行业黑幕与数据造假；民生消费议题；社会现象批判 输出要求：使用markdown格式返回 输出格式：- 事件描述 - 事件概括：（前因后果）- 相关引用：url...",
//     "stream": false
//   }