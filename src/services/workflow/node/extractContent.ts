import * as fs from 'fs/promises';
import path from 'path';
import { deepseekUtil } from '../../utils/deepseekUtil';
import { createModuleLogger } from '../../utils/logger';
import { openAIClient } from '@/services/utils/openaiClient';

// 创建模块特定的日志记录器
const logger = createModuleLogger('extract-content');

interface AnalysisResult {
  theme: string;
  time_line: string;
  sections: string[];
}

export class ExtractContentService {
  private readonly promptDir: string = 'src/prompt/v3';
  private readonly logsDir: string = 'public/logs/extract_content';
  private readonly analyzePromptFile: string = '01_analyze.md';

  constructor() {
    // 确保日志目录存在
    // this.ensureLogDir();
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
   * 加载分析提示词
   */
  private async loadAnalyzePrompt(): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), this.promptDir, this.analyzePromptFile);
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      logger.error('加载分析提示词失败', { error });
      throw new Error('无法加载分析提示词');
    }
  }

  /**
   * 提取内容并分析
   * @param content 要分析的内容
   * @returns 分析结果
   */
  public async extractAndAnalyze(content: string): Promise<AnalysisResult[]> {

    logger.info('开始提取和分析内容', { contentLength: content.length });

    // 加载分析提示词
    const analyzePrompt = await this.loadAnalyzePrompt();

    // 替换提示词中的占位符
    const finalPrompt = analyzePrompt.replace('{$context}', content);

    // 调用 DeepSeek R1 模型
    const response = await deepseekUtil.chat([
      { role: 'user', content: finalPrompt }
    ]);

    // 提取响应内容
    let responseContent = response.choices[0]?.message?.content || '';

    // 记录分析结果
    logger.info('分析结果记录完成', { responseContent });

    // 解析 JSON 结果

    // 如果存在 ```json，或者存在 ```，则提取 ```json 和 ``` 之间的内容，或者 ``` 和 ``` 之间的内容
    const jsonMatch = responseContent.replace('```json', '').replace('```', '');

    let results: AnalysisResult[] = [];
    try {
      results = JSON.parse(jsonMatch);
    } catch (error) {
      // 调用 DeepSeek v3 进行数据校对
      const response = await openAIClient.executeWithModel("deepseekV3", async (client, model) => {
        const result = await openAIClient.chat([
          { role: 'user', content: `
            当前内容在程序中检测不符合 json 格式, 请你帮忙处理为正确的 json 格式并返回，
            只返回调整好的 json 文本即可，不要加入其他的说明和标识.
            当前内容为：
            ` + jsonMatch
          }
        ], {
          model: 'deepseek-chat',  // 指定使用 DeepSeek V3 模型
          temperature: 1.0
        });
        return result.choices[0]?.message?.content || '';
      });
      results = JSON.parse(response) as AnalysisResult[];
    }
    return results;
  }

}
// 导出单例
export const extractContentService = new ExtractContentService();
