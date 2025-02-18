import { NextRequest, NextResponse } from 'next/server';
import { articleCreator } from '@/services/v2/creation/articleCreator';
import * as fs from 'fs/promises';
import path from 'path';

/**
 * @swagger
 * /api/create:
 *   post:
 *     summary: 创建文章
 *     description: 使用多个模型和提示词创作文章
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *                 description: 创作主题或问题
 *                 example: "请写一篇关于副业的文章"
 *               filePath:
 *                 type: string
 *                 description: 文件路径
 *                 example: "public/input/article.md"
 *     responses:
 *       200:
 *         description: 创作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "创作完成"
 *                 outputDir:
 *                   type: string
 *                   example: "/output/articles/2024-02-20T12-34-56"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, filePath } = body;
    
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

      const content = await fs.readFile(absolutePath, 'utf-8');
      const result = await articleCreator.createArticle(content);
      
      return NextResponse.json({
        success: true,
        message: '创作完成',
        outputDir: result.outputDir,
        inputFile: path.basename(filePath)
      });
    }
    
    // 如果提供了问题文本，直接使用
    if (question) {
      const result = await articleCreator.createArticle(question);
      
      return NextResponse.json({
        success: true,
        message: '创作完成',
        outputDir: result.outputDir
      });
    }

    // 如果既没有文件路径也没有问题文本
    return NextResponse.json(
      { error: '请提供创作主题或文件路径' },
      { status: 400 }
    );

  } catch (error) {
    console.error('创作过程出错:', error);
    return NextResponse.json(
      { error: `创作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 