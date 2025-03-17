import * as fs from 'fs/promises';
import path from 'path';
import { extractContentService } from './node/extractContent';
import { firstCreateService } from './node/firstCreate';
import { createModuleLogger } from '../utils/logger';
import { reasonerDialogService } from './node/reasonerDialogService';
import { reviewArticleService } from './node/reviewArticle';

// 创建模块特定的日志记录器
const logger = createModuleLogger('workflow');

const articleLogger = createModuleLogger('article');

interface AnalysisResult {
    theme: string;
    time_line: string;
    sections: string[];
}

export class ArticleWorkflowService {
    /**
     * 从文件中提取内容并分析
     * @param filePath 文件路径
     * @returns 分析结果
     */
    public async analyzeContentFromFile(filePath: string): Promise<string> {

        // 检查文件是否存在
        const absolutePath = await this.checkFileExists(filePath);

        // 读取文件内容
        const content = await this.readFile(absolutePath);

        // 调用 extractAndAnalyze 方法进行分析
        // let results = await extractContentService.extractAndAnalyze(content.trim());
        // console.info('内容分析完成', {
        //     filePath,
        //     themesCount: results.length
        // });

        const original_text = content;
        // 测试效果,只取第一个
        // results = results.slice(0, 1);
        let results = [original_text];

        let articleParagraphs: string[] = [];

        // 循环results
        for (const result of results) {
            // 文章的主题
            // const theme = result.theme

            // 调用 firstCreateService 方法进行创作
            const firstParagraph = await firstCreateService.createFirstParagraph(result);
            // 把 firstParagraph 添加到 articleParagraphs 中
            articleParagraphs.push(firstParagraph);

            let isEnd = 'no';

            // 调用 reasonerDialogService 方法进行对话
            const dialgArticleParagraphs = await reasonerDialogService.executeDialog(original_text, firstParagraph, isEnd);
            // 把后续创作的内容添加到 articleParagraphs 中
            articleParagraphs.push(...dialgArticleParagraphs);

            // 结束循环后，如果 isEnd 为 no，则需要执行结束段落的创作
            let finalContent = articleParagraphs.join('\n\n');
            if (isEnd === 'no') {
                const endWriteResponse = await reasonerDialogService.endWrite(finalContent);
                finalContent = finalContent + '\n\n' + endWriteResponse;

                articleParagraphs.push(endWriteResponse);
            }

            // 日志记录 currentContent
            await articleLogger.info(finalContent);
            // 记录对话结束
            await reasonerDialogService.logSessionEnd();

            // 进行文章审查
            // await this.reviewArticleParagraphs(articleParagraphs);


            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = path.join(process.cwd(), 'public/output', `article-original-${timestamp}.md`);

            // 确保输出目录存在
            await fs.mkdir(path.join(process.cwd(), 'public/output'), { recursive: true });

            // 写入文件
            await fs.writeFile(outputFile, finalContent, 'utf-8');

        }

        const article = articleParagraphs.join('\n\n');

        return article;
    }


    private async reviewArticleParagraphs(articleParagraphs: string[]) {
        // 调用 reviewArticleService 方法对 articleParagraphs 进行文章审查
        try {
            logger.info('开始对文章段落进行审查', { paragraphsCount: articleParagraphs.length });

            // 审查文章段落并获取审查结果
            const reviewResults = await reviewArticleService.reviewArticleParagraphs(articleParagraphs[0]);

            // 将原始段落和审查结果保存到文件
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = path.join(process.cwd(), 'public/output', `article-with-reviews-${timestamp}.md`);

            // 确保输出目录存在
            await fs.mkdir(path.join(process.cwd(), 'public/output'), { recursive: true });

            // 准备输出内容
            let outputContent = '# 文章与审查结果\n\n';

            for (let i = 0; i < reviewResults.length; i++) {
                outputContent += `# 第${i + 1}段\n\n${articleParagraphs[i]}\n\n`;
                outputContent += `### 审查结果\n\n${reviewResults[i]}\n\n`;
            }

            // 写入文件
            await fs.writeFile(outputFile, outputContent, 'utf-8');

            logger.info('文章段落审查完成并保存');

            return `文章生成并审查完成，已保存到: ${outputFile}`;
        } catch (error) {
            logger.error('文章审查过程中出错', { error });

            // 即使审查失败，也保存原始文章
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = path.join(process.cwd(), 'public/output', `article-original-${timestamp}.md`);

            // 确保输出目录存在
            await fs.mkdir(path.join(process.cwd(), 'public/output'), { recursive: true });

            // 写入文件
            await fs.writeFile(outputFile, articleParagraphs.join('\n\n'), 'utf-8');

            return `文章生成完成，但审查过程中出错。原始文章已保存到: ${outputFile}`;
        }
    }

    public async checkFileExists(filePath: string): Promise<string> {
        // 确保文件路径是绝对路径
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(process.cwd(), filePath);
        // 检查文件是否存在
        try {
            await fs.access(absolutePath);
        } catch (error) {
            logger.error('文件不存在', { filePath, absolutePath, error });
            throw new Error(`文件不存在: ${filePath}`);
        }
        return absolutePath;
    }

    public async readFile(absolutePath: string): Promise<string> {
        // 读取文件内容
        console.debug('读取文件内容', { absolutePath });
        const content = await fs.readFile(absolutePath, 'utf-8');

        if (!content || content.trim() === '') {
            logger.warn('文件内容为空', { absolutePath });
            throw new Error(`文件内容为空: ${absolutePath}`);
        }
        return content;
    }


    /**
     * 验证分析结果格式
     * @param results 分析结果
     * @returns 格式化后的分析结果
     */
    public validateAndFormatResults(results: any[]): AnalysisResult[] {
        try {
            logger.debug('验证和格式化分析结果', { resultsCount: results.length });

            if (!Array.isArray(results)) {
                logger.warn('分析结果不是数组');
                return [];
            }

            const formattedResults: AnalysisResult[] = results.map((item, index) => {
                // 确保每个项目都有必要的字段
                const theme = item.theme || `未命名主题 ${index + 1}`;
                const time_line = item.time_line || '无时间轴信息';
                const sections = Array.isArray(item.sections) ? item.sections : [];

                return {
                    theme,
                    time_line,
                    sections
                };
            });

            logger.debug('分析结果格式化完成', {
                formattedResultsCount: formattedResults.length
            });

            return formattedResults;
        } catch (error) {
            logger.error('验证和格式化分析结果失败', { error });
            return [];
        }
    }

    /**
     * 完整工作流：从文件中提取内容，分析，并格式化结果
     * @param filePath 文件路径
     * @returns 格式化后的分析结果
     */
    public async executeWorkflow(filePath: string): Promise<string> {
        logger.info('开始执行工作流', { filePath });

        // 从文件中提取和分析内容
        const analysisResults = await this.analyzeContentFromFile(filePath);

        return analysisResults;
    }
}

// 导出单例
export const articleWorkflowService = new ArticleWorkflowService();
