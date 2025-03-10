import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../../utils/openaiClient';
import { createModuleLogger } from '../../utils/logger';

// 创建模块特定的日志记录器
const logger = createModuleLogger('web-content-extractor');

export class WebContentExtractor {
  private readonly promptDir: string = 'src/prompt/v3';
  private readonly logsDir: string = 'public/logs/web_content_extractor';
  private readonly extractPromptFile: string = '02_webConentExtract.md';

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
   * 加载提取提示词
   */
  private async loadExtractPrompt(): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), this.promptDir, this.extractPromptFile);
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      logger.error('加载提取提示词失败', { error });
      throw new Error('无法加载提取提示词');
    }
  }

  /**
   * 从网页内容中提取与主题相关的内容
   * @param theme 主题
   * @param webContent 网页内容
   * @returns 提取的内容
   */
  public async extractContent(theme: string, webContent: string): Promise<string> {
    try {
      logger.info(`开始从网页内容中提取与主题相关的内容`, { theme });
      
      // 加载提取提示词
      const extractPrompt = await this.loadExtractPrompt();
      
      // 替换提示词中的占位符
      const finalPrompt = extractPrompt
        .replace('{$theme}', theme)
        .replace('{$web_content}', webContent);
      
      // 调用 DeepSeek V3 模型
      const response = await openAIClient.executeWithModel("deepseekV3", async (client, model) => {
        return await openAIClient.chat([
          { role: "user", content: finalPrompt }
        ], {
          model: model,
          temperature: 1.0
        });
      });
      const result =  response.choices[0]?.message?.content || '';
      
      // 记录提取结果
      logger.info('内容提取完成', { 
        theme, 
        content: result 
      });
      
      return result;
    } catch (error) {
      logger.error('提取网页内容失败', { error, theme });
      throw error;
    }
  }
}

// 导出单例
export const webContentExtractor = new WebContentExtractor(); 