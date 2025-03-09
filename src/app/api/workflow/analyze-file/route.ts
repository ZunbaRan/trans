import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/services/workflow/workflow';
import logger from '@/services/utils/logger';

/**
 * @swagger
 * /api/workflow/analyze-file:
 *   post:
 *     summary: 分析文件内容
 *     description: 从指定文件中读取内容，并使用 DeepSeek R1 模型进行分析，生成爆款文章选题
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
 *                 example: "data/articles/sample.txt"
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
 *                         example: "人工智能如何改变我们的生活方式"
 *                       time_line:
 *                         type: string
 *                         example: "2010年：IBM Watson问世；2016年：AlphaGo战胜李世石..."
 *                       sections:
 *                         type: array
 *                         items:
 *                           type: string
 *                           example: "人工智能正在以前所未有的速度改变着我们的日常生活..."
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 文件不存在
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      logger.warn('请求缺少有效的文件路径');
      return NextResponse.json(
        { error: '请提供有效的文件路径' },
        { status: 400 }
      );
    }

    logger.info('开始处理文件分析请求', { filePath });

    // 执行工作流
    const results = await workflowService.executeWorkflow(filePath.trim());
    
    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    // 处理特定错误
    if (errorMessage.includes('文件不存在')) {
      logger.error('文件不存在', { error });
      return NextResponse.json(
        { error: `文件不存在: ${errorMessage}` },
        { status: 404 }
      );
    }
    
    logger.error('文件分析失败', { error });
    return NextResponse.json(
      { error: `操作失败: ${errorMessage}` },
      { status: 500 }
    );
  }
} 