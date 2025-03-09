import { NextRequest, NextResponse } from 'next/server';
import { reasonerDialogService } from '@/services/workflow/node/reasonerDialogService';
import path from 'path';

/**
 * @swagger
 * /api/reasoner-dialog:
 *   post:
 *     summary: 执行两个推理模型之间的对话
 *     description: 让两个推理模型围绕指定话题进行多轮对话
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic:
 *                 type: string
 *                 description: 对话的初始话题
 *                 example: "人工智能的未来发展趋势"
 *     responses:
 *       200:
 *         description: 对话执行成功
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
 *                   example: "对话执行完成"
 *                 dialogHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       round:
 *                         type: number
 *                         example: 1
 *                       speaker:
 *                         type: string
 *                         example: "model1"
 *                       content:
 *                         type: string
 *                         example: "人工智能的未来发展将更加注重与人类的协作..."
 *                 sessionDir:
 *                   type: string
 *                   example: "/logs/reasoner_dialogs/session_2023-05-20T12-34-56"
 *                 model1LogFile:
 *                   type: string
 *                   example: "/logs/reasoner_dialogs/session_2023-05-20T12-34-56/model1.log"
 *                 model2LogFile:
 *                   type: string
 *                   example: "/logs/reasoner_dialogs/session_2023-05-20T12-34-56/model2.log"
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();
    
    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return NextResponse.json(
        { error: '请提供有效的对话话题' },
        { status: 400 }
      );
    }

    // 执行推理模型对话
    const dialogHistory = await reasonerDialogService.executeDialog(topic.trim());
    
    // 获取会话目录路径（相对于公共目录）
    const sessionDir = reasonerDialogService.getCurrentSessionDir();
    const rulerLogFile = reasonerDialogService.getCurrentRulerLogFile();
    const creatorLogFile = reasonerDialogService.getCurrentCreatorLogFile();
    
    const relativePath = sessionDir ? path.relative(path.join(process.cwd(), 'public'), sessionDir) : '';
    const relativeRulerLog = rulerLogFile ? path.relative(path.join(process.cwd(), 'public'), rulerLogFile) : '';
    const relativeCreatorLog = creatorLogFile ? path.relative(path.join(process.cwd(), 'public'), creatorLogFile) : '';
    
    return NextResponse.json({
      success: true,
      message: '对话执行完成',
      dialogHistory,
      sessionDir: relativePath ? `/${relativePath.replace(/\\/g, '/')}` : null,
      rulerLogFile: relativeRulerLog ? `/${relativeRulerLog.replace(/\\/g, '/')}` : null,
      creatorLogFile: relativeCreatorLog ? `/${relativeCreatorLog.replace(/\\/g, '/')}` : null
    });

  } catch (error) {
    console.error('执行推理模型对话失败:', error);
    return NextResponse.json(
      { error: `对话执行失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 