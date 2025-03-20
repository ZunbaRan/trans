import { NextRequest, NextResponse } from 'next/server';
import { longTextToSimpleArticle } from '@/services/workflow/longTextToSimpleArticle';
import logger from '@/services/utils/logger';

/**
 * @swagger
 * /api/workflow/longTextToSimpleArticle:
 *   post:
 *     summary: 分析文件内容
 *     description: 读取指定目录中的文件（context.txt、timeline.md、report.md），并生成多种风格的文章
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: 包含所需文件的文件路径
 *                 example: "data/articles/sample"
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
  let filePath = ''; // 在函数顶部声明变量
  
  try {
    const requestData = await request.json();
    filePath = requestData.filePath; // 赋值
    
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      logger.warn('请求缺少有效的文件路径');
      return NextResponse.json(
        { error: '请提供有效的文件路径' },
        { status: 400 }
      );
    }

    logger.info('开始处理文件分析请求', { filePath });

    // 执行工作流
    const results = await longTextToSimpleArticle.executeWorkflow(filePath.trim());
    
    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // 处理特定错误
    if (errorMessage.includes('文件不存在')) {
      logger.error('文件不存在', { error: { message: errorMessage, stack: errorStack }, filePath });
      return NextResponse.json(
        { error: `文件不存在: ${errorMessage}` },
        { status: 404 }
      );
    }
    
    logger.error('文件分析失败', { 
      error: { 
        message: errorMessage, 
        stack: errorStack,
      },
      filePath // 现在 filePath 在作用域内
    });
    return NextResponse.json(
      { 
        error: `操作失败: ${errorMessage}`,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 