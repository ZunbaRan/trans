import { NextRequest, NextResponse } from 'next/server';
import { webContentExtractor } from '@/services/workflow/node/webContentExtractor';
import logger from '@/services/utils/logger';

/**
 * @swagger
 * /api/extract-web-content:
 *   post:
 *     summary: 从网页内容中提取与主题相关的内容
 *     description: 使用 DeepSeek V3 模型从网页内容中提取与特定主题相关的内容
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 description: 提取内容的主题
 *                 example: "人工智能在医疗领域的应用"
 *               webContent:
 *                 type: string
 *                 description: 要分析的网页内容
 *                 example: "这是一段网页内容，包含了各种信息..."
 *     responses:
 *       200:
 *         description: 提取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 extractedContent:
 *                   type: string
 *                   example: "人工智能在医疗领域的应用主要包括..."
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { theme, webContent } = await request.json();
    
    if (!theme || typeof theme !== 'string' || theme.trim() === '') {
      logger.warn('请求缺少有效的主题');
      return NextResponse.json(
        { error: '请提供有效的主题' },
        { status: 400 }
      );
    }
    
    if (!webContent || typeof webContent !== 'string' || webContent.trim() === '') {
      logger.warn('请求缺少有效的网页内容');
      return NextResponse.json(
        { error: '请提供有效的网页内容' },
        { status: 400 }
      );
    }

    logger.info('开始处理网页内容提取请求', { 
      theme, 
      webContentLength: webContent.length 
    });

    // 提取内容
    const extractedContent = await webContentExtractor.extractContent(
      theme.trim(),
      webContent.trim()
    );
    
    logger.info('网页内容提取完成', { 
      theme, 
      extractedContentLength: extractedContent.length 
    });
    
    return NextResponse.json({
      success: true,
      extractedContent
    });

  } catch (error) {
    logger.error('提取网页内容失败', { error });
    return NextResponse.json(
      { error: `操作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 