import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { ContentAnalyzer } from '@/services/v2/contentAnalyzer';

/**
 * @swagger
 * /api/analyze:
 *   post:
 *     summary: 分析文本内容
 *     description: 读取指定文件并进行内容分析，生成分析报告
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: 要分析的文件路径
 *                 example: "/path/to/file.txt"
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
 *                 message:
 *                   type: string
 *                   example: "分析完成"
 *                 outputPath:
 *                   type: string
 *                   example: "/public/output/file_analysis.md"
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json(
        { error: '请提供文件路径' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 创建分析器实例
    const outputDir = path.join(process.cwd(), 'public/output');
    const logsDir = path.join(process.cwd(), 'public/logs');
    const analyzer = new ContentAnalyzer(
      path.join(outputDir, 'analysis.md'),
      path.join(logsDir, 'analysis.log')
    );

    // 执行分析
    const results = await analyzer.analyze(content);

    // 生成输出文件名
    let outputFileName = path.basename(filePath, path.extname(filePath));
    outputFileName = outputFileName.replace('_simplified', '');
    const outputPath = path.join(outputDir, `${outputFileName}_analysis.md`);

    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });

    // 写入分析结果
    await fs.writeFile(outputPath, results.join('\n'), 'utf-8');

    return NextResponse.json({
      success: true,
      message: '分析完成',
      outputPath: outputPath
    });

  } catch (error) {
    console.error('分析过程出错:', error);
    return NextResponse.json(
      { error: `分析失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 