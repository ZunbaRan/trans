import { NextRequest, NextResponse } from 'next/server';
import { extractContentService } from '@/services/workflow/node/extractContent';
import * as fs from 'fs/promises';
import path from 'path';

/**
 * @swagger
 * /api/extract-content:
 *   post:
 *     summary: 提取和分析内容
 *     description: 使用 DeepSeek R1 模型提取和分析内容，生成爆款文章选题
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: 要分析的内容
 *               filePath:
 *                 type: string
 *                 description: 可选的文件路径，如果提供则读取文件内容
 *     responses:
 *       200:
 *         description: 分析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       theme:
 *                         type: string
 *                       time_line:
 *                         type: string
 *                       sections:
 *                         type: array
 *                         items:
 *                           type: string
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { content, filePath } = await request.json();
    
    let finalContent = content;
    
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

      finalContent = await fs.readFile(absolutePath, 'utf-8');
    }
    
    if (!finalContent || typeof finalContent !== 'string' || finalContent.trim() === '') {
      return NextResponse.json(
        { error: '请提供有效的内容或文件路径' },
        { status: 400 }
      );
    }

    // 提取和分析内容
    const results = await extractContentService.extractAndAnalyze(finalContent.trim());
    
    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('提取和分析内容失败:', error);
    return NextResponse.json(
      { error: `操作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 