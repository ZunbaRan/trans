import * as fs from 'fs/promises';
import path from 'path';
import { deepseekUtil } from '../../utils/deepseekUtil';
import { createModuleLogger } from '../../utils/logger';

// 创建模块特定的日志记录器
const logger = createModuleLogger('first-create');

// 定义 AnalysisResult 接口
interface AnalysisResult {
  theme: string;
  time_line: string;
  sections: string[];
}

export class FirstCreateService {
  private readonly promptDir: string = 'src/prompt/v3';
  private readonly logsDir: string = 'public/logs/first_create';
  private readonly firstWritePromptFile: string = '03_firstWrite.md';

  constructor() {
    // 确保日志目录存在
    this.ensureLogDir();
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(path.join(process.cwd(), this.logsDir), { recursive: true });
    } catch (error) {
      logger.error('创建日志目录失败', { error });
    }
  }

  /**
   * 加载首次创作提示词
   */
  private async loadFirstWritePrompt(): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), this.promptDir, this.firstWritePromptFile);
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      logger.error('加载首次创作提示词失败', { error });
      throw new Error('无法加载首次创作提示词');
    }
  }

  /**
   * 创建文章开头段落
   * @param originContent 原始内容分析结果
   * @param banfo 半佛仙人文风参考
   * @returns 生成的文章开头段落
   */
  public async createFirstParagraph(originContent: AnalysisResult): Promise<string> {
    try {
      console.info('开始创建文章开头段落', { 
        theme: originContent.theme,
        sectionsCount: originContent.sections.length 
      });
      
      // 加载首次创作提示词
      const firstWritePrompt = await this.loadFirstWritePrompt();
      
      // 读取半佛仙人文风参考
      const banfo = await fs.readFile(path.join(process.cwd(), 'src/prompt/v3/banfo.md'), 'utf-8');

      // 将 AnalysisResult 转换为字符串
      const originContentStr = JSON.stringify({
        theme: originContent.theme,
        time_line: originContent.time_line,
        sections: originContent.sections
      }, null, 2);
      
      // 替换提示词中的占位符
      const finalPrompt = firstWritePrompt
        .replace('{$theme}', originContent.theme)
        .replace('{$orign_content}', originContentStr)
        .replace('{$banfo}', banfo);
      
      // 日志记录 finalPrompt
      console.debug('创建了最终提示词', { promptLength: finalPrompt.length, finalPrompt: finalPrompt });
      
      // 调用 DeepSeek 模型
      const response = await deepseekUtil.chat([
        { role: 'user', content: finalPrompt }
      ]);
      
      // 提取响应内容
      const generatedContent = response.choices[0]?.message?.content || '';
      
      // 记录生成结果
    //   await this.logGenerationResult(originContent.theme, generatedContent);
      
      console.info('文章开头段落创建完成', { 
        theme: originContent.theme,
        contentLength: generatedContent.length 
      });
      
      return generatedContent;
    } catch (error) {
      logger.error('创建文章开头段落失败', { error, theme: originContent.theme });
      throw error;
    }
  }

  /**
   * 记录生成结果
   * @param theme 主题
   * @param generatedContent 生成的内容
   */
  private async logGenerationResult(theme: string, generatedContent: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(process.cwd(), this.logsDir, `generation_${timestamp}.json`);
      
      const logContent = {
        timestamp: new Date().toISOString(),
        theme,
        generated_content: generatedContent
      };
      
      await fs.writeFile(logFile, JSON.stringify(logContent, null, 2), 'utf-8');
      console.debug('生成结果已记录到文件', { logFile });
    } catch (error) {
      logger.error('记录生成结果失败', { error });
    }
  }
}

// 导出单例
export const firstCreateService = new FirstCreateService();
