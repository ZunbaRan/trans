import { NextRequest } from 'next/server';
import { testDeepGeminiStream } from '@/services/utils/test';
import * as fs from 'fs/promises';
import path from 'path';

/**
 * @swagger
 * /api/deepgemini/stream:
 *   post:
 *     summary: 调用 DeepGemini 模型（流式输出）
 *     description: 使用 DeepSeek 进行推理，然后用 Gemini 生成最终回答，以流式方式返回
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: 用户输入的提示词
 *                 example: "请分析这段文字的主要观点"
 *               filePath:
 *                 type: string
 *                 description: 可选的文件路径，如果提供则读取文件内容作为输入
 *                 example: "public/input/article.md"
 *     responses:
 *       200:
 *         description: 流式处理成功
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, filePath } = body;
    
    let finalPrompt = prompt;
    
    // 如果提供了文件路径，则从文件读取内容
    if (filePath) {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), filePath);

      try {
        await fs.access(absolutePath);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: '文件不存在' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      
      // 如果提供了提示词，则将文件内容附加到提示词后面
      if (prompt) {
        finalPrompt = `${prompt}\n\n${fileContent}`;
      } else {
        finalPrompt = fileContent;
      }
    }
    
    if (!finalPrompt) {
      return new Response(
        JSON.stringify({ error: '请提供提示词或文件路径' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 创建流式响应
    const stream = testDeepGeminiStream(finalPrompt);
    
    // 设置响应头
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    };
    
    // 创建 ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
    
    return new Response(readableStream, { headers });

  } catch (error) {
    console.error('DeepGemini 流式 API 调用失败:', error);
    return new Response(
      JSON.stringify({ error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 