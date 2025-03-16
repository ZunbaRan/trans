import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../../utils/openaiClient';
import { createModuleLogger } from '../../utils/logger';
import { deepseekUtil } from '@/services/utils/deepseekUtil';
import { deepGemini } from '@/services/utils/deepGemini';

// 创建模块特定的日志记录器
const logger = createModuleLogger('review-article');

/**
 * 文章审查结果接口
 */
interface ReviewResult {
  unreasonableParts: {
    originalText: string;
    suggestion: string;
  }[];
  improvedArticle: string;
}

export class ReviewArticleService {
  private readonly promptDir: string = 'src/prompt/v3';
  private readonly logsDir: string = 'public/logs/review_article';
  private readonly localPromptFile: string = '07_lcocalReviewArticle.md';
  private readonly banfotyPromptFile: string = '08_banfoty.md';
  private readonly deepbanfotyPromptFile: string = '08_deepbanfoty.md';
  private readonly reviewPromptFile: string = '09_reviewArticle.md';

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
   * 记录审查日志
   * @param paragraphs 原始段落数组
   * @param reviewResults 审查结果数组
   */
  private async logReviews(paragraphs: string[], reviewResults: string[]): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(process.cwd(), this.logsDir, `reviews-${timestamp}.md`);

      let logContent = '# 文章段落审查日志\n\n';

      // 为每个段落添加审查结果
      for (let i = 0; i < paragraphs.length; i++) {
        logContent += `## 段落 ${i + 1}\n\n`;
        logContent += `### 原始内容\n\n${paragraphs[i]}\n\n`;
        logContent += `### 审查结果\n\n${reviewResults[i]}\n\n`;
        logContent += '---\n\n';
      }

      await fs.writeFile(logFile, logContent, 'utf-8');
      logger.info('审查日志已保存', { logFile, paragraphsCount: paragraphs.length });
    } catch (error) {
      logger.error('保存审查日志失败', { error });
    }
  }

  public async localReview(paragraph: string): Promise<string> {
    // 加载审查提示词
    const promptPath = path.join(process.cwd(), this.promptDir, this.localPromptFile);
    const reviewPrompt = await fs.readFile(promptPath, 'utf-8');

    // 审查段落
    const reviewResult = await this.baseReview(paragraph, reviewPrompt);
    return reviewResult;
  }

  // 常规文风改编
  public async banfotyReview(paragraph: string): Promise<string> {
    // 加载审查提示词
    const promptPath = path.join(process.cwd(), this.promptDir, this.banfotyPromptFile);
    const reviewPrompt = await fs.readFile(promptPath, 'utf-8');

    // 审查段落
    const reviewResult = await this.baseReview(paragraph, reviewPrompt);
    return reviewResult;
  }

  // 特殊文风改编
  public async deepbanfotyReview(paragraph: string): Promise<string> {
    // 加载审查提示词
    const promptPath = path.join(process.cwd(), this.promptDir, this.deepbanfotyPromptFile);
    const reviewPrompt = await fs.readFile(promptPath, 'utf-8');

    // 审查段落
    const reviewResult = await this.seekbaseReview(paragraph, reviewPrompt);
    return reviewResult;
  }


  public async reviewParagraph(paragraph: string): Promise<string> {
          // 加载审查提示词
    const promptPath = path.join(process.cwd(), this.promptDir, this.reviewPromptFile);
    const reviewPrompt = await fs.readFile(promptPath, 'utf-8');

    // 审查段落
    const reviewResult = await this.baseReview(paragraph, reviewPrompt);

    return reviewResult;
  }



  /**
   * 审查单个段落
   * @param paragraph 要审查的段落
   * @returns 审查结果
   */
  public async baseReview(paragraph: string, reviewPrompt: string): Promise<string> {
    try {
      logger.info('开始审查段落');


      // 替换提示词中的占位符
      const finalPrompt = reviewPrompt.replace('{$article}', paragraph);

      // 调用 deepGemini 模型进行审查
      const messages: any[] = [];

      messages.unshift({
        role: 'user',
        content: finalPrompt
      });

      const response = await deepGemini.chat(messages);

      const reviewResult = response.choices[0]?.message?.content || '';

      logger.info('段落审查完成', {
        request: paragraph,
        result: reviewResult
      });

      return reviewResult;
    } catch (error) {
      logger.error('审查段落失败', { error });
      throw error;
    }
  }

  public async seekbaseReview(paragraph: string, reviewPrompt: string): Promise<string> {
    try {
      logger.info('开始审查段落');


      // 替换提示词中的占位符
      const finalPrompt = reviewPrompt.replace('{$article}', paragraph);

      // 调用 deepGemini 模型进行审查
      const messages: any[] = [];

      messages.unshift({
        role: 'user',
        content: finalPrompt
      });

      const deepseekResult = await deepseekUtil.chat(messages);

      const deepseekArticle = deepseekResult.choices[0]?.message?.content || '';

      const deepseekReasoning = deepseekResult.choices[0]?.message?.reasoning_content || '';

      const deepGeminiResult = await deepGemini.chatWithReasoning(messages, deepseekReasoning);

      const deepGeminiArticle = deepGeminiResult.choices[0]?.message?.content || '';

      const reviewResult = '## 深度seek改编\n\n' + deepGeminiArticle + '\n\n' + 
                           '## 深度Gemini改编\n\n' + deepseekArticle;

      logger.info('段落审查完成', {
        request: paragraph,
        result: reviewResult
      });

      return reviewResult;
    } catch (error) {
      logger.error('审查段落失败', { error });
      throw error;
    }
  }

  /**
   * 批量审查文章段落
   * @param paragraphs 文章段落数组
   * @returns 审查结果数组
   */
  public async reviewArticleParagraphs(paragraphs: string): Promise<string> {

    logger.info('开始审查文章');

    let reviewResult: string = '';

    // 对每个段落单独进行审查
    try {
      // 审查当前段落
      reviewResult = await this.reviewParagraph(paragraphs);
      logger.info('审查完成');

      // 直接返回 AI 的审查结果
      return reviewResult;
    } catch (error) {
      logger.error('批量审查文章段落失败', { error });
      // 如果整体审查过程失败，返回原始段落
      return paragraphs;
    }
  }
}

  // 导出单例
  export const reviewArticleService = new ReviewArticleService(); 