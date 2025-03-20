import { NextRequest, NextResponse } from 'next/server';
import { deepArticleWorkflowService } from '@/services/workflow/deepArticleWorkflow';
import { createModuleLogger } from '@/services/utils/logger';

const logger = createModuleLogger('api-convert-article');

/**
 * @swagger
 * /api/workflow/deepArticleWorkflow:
 *   post:
 *     summary: 将文件内容转换为文章
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
 *         description: 转换成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 article:
 *                   type: string
 *                   description: 生成的文章内容
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
  


    // 执行工作流
    const article = await deepArticleWorkflowService.executeWorkflow(filePath.trim());
    
    return NextResponse.json({
      success: true,
      article
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
    
    logger.error('文章转换失败', { 
      error: { 
        message: errorMessage, 
        stack: errorStack,
      },
      filePath // 现在 folderPath 在作用域内
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