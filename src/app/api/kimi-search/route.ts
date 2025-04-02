import { NextRequest, NextResponse } from 'next/server';
import { kimiWebSearch } from '@/services/utils/kimi';
import { createModuleLogger } from '@/services/utils/logger';

const logger = createModuleLogger('kimi-search-api');

/**
 * @swagger
 * /api/kimi-search:
 *   post:
 *     summary: 使用 Kimi 进行联网搜索
 *     description: 调用 Kimi API 进行联网搜索并返回结果
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: 搜索查询
 *                 example: "2024年最新的人工智能发展趋势"
 *               stream:
 *                 type: boolean
 *                 description: 是否使用流式响应
 *                 example: false
 *     responses:
 *       200:
 *         description: 搜索成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { query, stream = false } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: '请提供搜索查询' },
        { status: 400 }
      );
    }

    logger.info(`接收到 Kimi 搜索请求: ${query}`);

    // 如果请求流式响应
    if (stream) {
      // 创建一个 ReadableStream
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // 使用生成器函数获取流式响应
            for await (const chunk of kimiWebSearch.streamSearch(query)) {
              // 将每个块编码并发送
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
            // 发送结束标记
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            logger.error('流式搜索出错:', error);
            controller.error(error);
          }
        }
      });

      // 返回流式响应
      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // 非流式响应
      const result = await kimiWebSearch.search(query);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }
  } catch (error) {
    logger.error('Kimi 搜索 API 调用失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
} 