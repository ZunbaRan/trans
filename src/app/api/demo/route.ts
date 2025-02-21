import { NextRequest, NextResponse } from 'next/server';
import { StepAnalyzer } from '@/services/v2/analyzers/stepAnalyzer';

/**
 * @swagger
 * /api/demo:
 *   post:
 *     summary: Markdown 转 JSON 结构
 *     description: 将指定路径的 Markdown 文件转换为 JSON 结构
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *                 description: Markdown 文件路径
 *                 example: "src/prompt/cn/articles/normal/normal_2.md"
 *     responses:
 *       200:
 *         description: 转换成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    
    if (!path) {
      return NextResponse.json(
        { error: '请提供文件路径' },
        { status: 400 }
      );
    }

    // 创建分析器实例并调用 demo 方法
    const analyzer = new StepAnalyzer(path);
    const result = await analyzer.demo(path);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Demo API 调用失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
} 