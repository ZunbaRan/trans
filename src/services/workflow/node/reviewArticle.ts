import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../../utils/openaiClient';
import { createModuleLogger } from '../../utils/logger';
import { deepseekUtil } from '@/services/utils/deepseekUtil';

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
  private readonly reviewPromptFile: string = '07_reviewArticle.md';

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
   * 加载审查提示词
   */
  private async loadReviewPrompt(): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), this.promptDir, this.reviewPromptFile);
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      logger.error('加载审查提示词失败', { error });
      throw new Error('无法加载审查提示词');
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

  /**
   * 审查单个段落
   * @param paragraph 要审查的段落
   * @returns 审查结果
   */
  public async reviewParagraph(paragraph: string): Promise<string> {
    try {
      logger.info('开始审查段落', { paragraphLength: paragraph.length });
      
      // 加载审查提示词
      const reviewPrompt = await this.loadReviewPrompt();
      
      // 替换提示词中的占位符
      const finalPrompt = reviewPrompt.replace('{$article}', paragraph);
      
      // 调用 deepseekUtil 模型进行审查
      const messages: any[] = [];

      messages.unshift({
        role: 'user',
        content: finalPrompt
      });

      const response = await deepseekUtil.chat(messages);
      
      const reviewResult = response.choices[0]?.message?.content || '';
      
      logger.info('段落审查完成', { 
        paragraphLength: paragraph.length,
        resultLength: reviewResult.length
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
  public async reviewArticleParagraphs(paragraphs: string[]): Promise<string[]> {
    try {
      logger.info('开始批量审查文章段落', { paragraphsCount: paragraphs.length });
      
      const reviewResults: string[] = [];
      
      // 对每个段落单独进行审查
      for (let i = 0; i < paragraphs.length; i++) {
        logger.info(`审查段落 ${i + 1}/${paragraphs.length}`);
        
        try {
          // 审查当前段落
          const result = await this.reviewParagraph(paragraphs[i]);
          reviewResults.push(result);
        } catch (error) {
          logger.error(`段落 ${i + 1} 审查失败`, { error });
          // 如果审查失败，添加原始段落作为结果
          reviewResults.push(`审查失败: ${paragraphs[i]}`);
        }
      }
      
      // 记录所有段落的审查结果
      // await this.logReviews(paragraphs, reviewResults);
      
      logger.info('所有段落审查完成', { 
        paragraphsCount: paragraphs.length,
        resultsCount: reviewResults.length
      });
      
      // 直接返回 AI 的审查结果
      return reviewResults;
    } catch (error) {
      logger.error('批量审查文章段落失败', { error });
      // 如果整体审查过程失败，返回原始段落
      return paragraphs;
    }
  }
}

// 导出单例
export const reviewArticleService = new ReviewArticleService(); 