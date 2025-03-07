import { NextRequest, NextResponse } from 'next/server';
import { tavilySearchUtil } from '@/services/utils/TavilySearchUtil';

/**
 * @swagger
 * /api/search/basic:
 *   post:
 *     summary: 基本搜索
 *     description: 使用 Tavily API 执行基本深度的网络搜索
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
 *         description: 搜索成功
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
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                       content:
 *                         type: string
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: '请提供有效的搜索查询' },
        { status: 400 }
      );
    }

    // 执行基本搜索
    const searchResponse = await tavilySearchUtil.basicSearch(query.trim());
    
    return NextResponse.json({
      success: true,
      query: searchResponse.query,
      responseTime: searchResponse.responseTime,
      results: searchResponse.results,
      images: searchResponse.images
    });

  } catch (error) {
    console.error('执行基本搜索失败:', error);
    return NextResponse.json(
      { error: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 