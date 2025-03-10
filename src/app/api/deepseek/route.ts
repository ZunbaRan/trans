import { NextRequest, NextResponse } from 'next/server';
import { deepseekUtil } from '@/services/utils/deepseekUtil';
import * as fs from 'fs/promises';
import path from 'path';

/**
 * @swagger
 * /api/deepseek:
 *   post:
 *     summary: 调用 DeepSeek R1 模型
 *     description: 使用 DeepSeek R1 模型处理用户提供的文本
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
 *         description: 处理成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 content:
 *                   type: string
 *                   example: "分析结果..."
 *                 reasoning:
 *                   type: string
 *                   example: "推理过程..."
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, filePath, options } = body;
    
    let finalPrompt = prompt;
    
    // 如果提供了文件路径，则从文件读取内容
    if (filePath) {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), filePath);

      try {
        await fs.access(absolutePath);
      } catch (error) {
        return NextResponse.json(
          { error: '文件不存在' },
          { status: 404 }
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
      return NextResponse.json(
        { error: '请提供提示词或文件路径' },
        { status: 400 }
      );
    }

    // 调用 DeepSeek R1 模型
    const response = await deepseekUtil.chat([
      { role: 'user', content: finalPrompt }
    ], options || {});
    
    // 提取响应内容
    const content = response.choices[0]?.message?.content || '';
    const reasoning = response.choices[0]?.message?.reasoning_content || '';
    
    return NextResponse.json({
      success: true,
      content,
      reasoning,
      usage: response.usage
    });

  } catch (error) {
    console.error('DeepSeek API 调用失败:', error);
    return NextResponse.json(
      { error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 