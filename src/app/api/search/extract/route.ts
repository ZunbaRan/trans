import { NextRequest, NextResponse } from 'next/server';
import { tavilySearchUtil } from '@/services/utils/TavilySearchUtil';

/**
 * @swagger
 * /api/search/extract:
 *   post:
 *     summary: 搜索并提取 URL 内容
 *     description: 使用 Tavily API 执行搜索，然后提取搜索结果中 URL 的内容
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: 搜索查询
 *                 example: "中国最新的人工智能政策"
 *     responses:
 *       200:
 *         description: 搜索并提取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 searchResponse:
 *                   type: object
 *                 extractedContents:
 *                   type: array
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { query, options = {
      searchDepth: 'advanced',
      includeAnswer: true,
      extractDepth: 'basic',
      includeImages: false
    } } = await request.json();

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: '请提供有效的搜索查询' },
        { status: 400 }
      );
    }

    // 执行搜索并提取内容
    const result = await tavilySearchUtil.searchAndExtract(
      query.trim(),
      options
    );

    return NextResponse.json({
      success: true,
      searchResponse: result.searchResponse,
      extractedContents: result.extractedContents
    });

  } catch (error) {
    console.error('搜索并提取内容失败:', error);
    return NextResponse.json(
      { error: `操作失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 