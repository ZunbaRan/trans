import * as fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '../utils/logger';
import { reviewArticleService } from './node/reviewArticle';
import { openAIClient } from '../utils/openaiClient';
import { deepGemini } from '../utils/deepGemini';
import { thinkingGeminiClient } from '../utils/geminiClient';
import { Message } from '../utils/baseClient';
// 创建模块特定的日志记录器
const logger = createModuleLogger('workflow');


interface AnalysisResult {
    theme: string;
    time_line: string;
    reference: { start_line: number, end_line: number }[];
}



export class LongTextToSimpleArticle {

    private readonly promptDir: string = 'src/prompt/long_text';


    public async convertToArticle(filePath: string): Promise<string> {
        console.info('开始从文件中提取和分析内容', { filePath });
        const contextPath = filePath + '/context.txt';
        const timelinePath = filePath + '/timeline.md';
        const reportPath = filePath + '/report.md';


        // 1. 直接生成文章
        const responseContent = await this.baseArticle(contextPath);


        // 2. 结合简报和时间轴丰富内容
        const enrichedArticle = await this.enrichArticle(responseContent, timelinePath, reportPath);


        // 审查文章
        const localReviewResults = await reviewArticleService.localReview(enrichedArticle);
        // alan 模仿文风
        // const freeAlanResults = await reviewArticleService.freeAlanReview(localReviewResults);
        // banfo
        const freeBanfoResults = await reviewArticleService.freeBanfoReview(localReviewResults);


        const allResults =
            '## 直接生成文章 \n\n' + responseContent + '\n\n' +
            // '## 结合简报和时间轴丰富内容\n\n' + enrichedArticle + '\n\n' +
            // '## 本地化+深度\n\n' + localReviewResults + '\n\n' +
            // '## alan 模仿文风\n\n' + freeAlanResults + '\n\n' +
            '## banfo 常规文风\n\n' + freeBanfoResults + '\n\n' ;
            // '## 第三次审查\n\n' + reviewResults + '\n\n' ;
            // '## deepseek改编\n\n' + deepseekArticle;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(process.cwd(), 'public/output', `article-original-${timestamp}.md`);

        // 确保输出目录存在
        await fs.mkdir(path.join(process.cwd(), 'public/output'), { recursive: true });

        // 写入文件
        await fs.writeFile(outputFile, allResults, 'utf-8');

        return allResults;
    }

    private async baseArticle(contextFilePath: string): Promise<string> {
        // 检查文件是否存在
        const absolutePath = await this.checkFileExists(contextFilePath);

        // 读取文件内容
        const contentText = await this.readFile(absolutePath);

        const prompt = `请阅读分析这篇文稿, 根据文稿创作一篇爆款文章, 要求文笔细腻,情感真挚, 使用中文输出,
        文稿为播客的文字稿，创作文章时请着重于文稿的话题观点和内容，切记不要把广告，播客主持人，嘉宾等人物写入文章中。
        文稿内容为：
        ` + contentText;

        const messages: Message[] = [
            { role: 'user', content: prompt }
        ];

        // 调用 ThinkingGemini 的对话方法
        logger.info('调用 ThinkingGemini 对话方法');


        const response = await thinkingGeminiClient.chat(messages, {
            maxOutputTokens: 8192
        });

        return response.choices[0].message.content || '';
    }


    private async enrichArticle(baseArticle: string, timelineFilePath: string, reportFilePath: string): Promise<string> {
        // 检查文件是否存在
        const timelineAbsolutePath = await this.checkFileExists(timelineFilePath);

        // 读取文件内容
        const timelineContent = await this.readFile(timelineAbsolutePath);

        const reportAbsolutePath = await this.checkFileExists(reportFilePath);

        // 读取文件内容
        const reportContent = await this.readFile(reportAbsolutePath);

        const prompt = `请结合这篇文稿的时间轴和简报, 丰富这篇文章, 要求文笔细腻,情感真挚, 使用中文输出
         文稿内容为：
         ` + baseArticle + '\n\n' +
            '时间轴：\n\n' + timelineContent + '\n\n' +
            '简报：\n\n' + reportContent;

        const messages: Message[] = [
            { role: 'user', content: prompt }
        ];

        // 调用 ThinkingGemini 的对话方法
        logger.info('调用 ThinkingGemini 对话方法');


        const response = await deepGemini.chat(messages);

        return response.choices[0].message.content || '';
    }

    /**
     * 解析 JSON 响应
     * @param content 响应内容
     * @returns 解析后的对象
     */
    private parseJsonResponse(content: string): any {
        // 尝试从响应中提取 JSON
        const jsonRegex = /```(?:json)?([\s\S]*?)```/;
        const jsonMatch = content.match(jsonRegex);

        if (jsonMatch && jsonMatch[1]) {
            // 从代码块中提取 JSON
            return JSON.parse(jsonMatch[1].trim());
        } else {
            // 尝试直接解析整个响应
            return JSON.parse(content);
        }
    }

    /**
     * 使用备用模型修复 JSON
     * @param content 原始响应内容
     * @returns 修复后的对象
     */
    private async fixJsonWithBackupModel(content: string): Promise<any> {
        // 调用 DeepSeek v3 进行数据校对
        const v3response = await openAIClient.executeWithModel("huoshan-deepseekV3", async (client, model) => {
            const result = await openAIClient.chat([
                {
                    role: 'user', content: `
当前内容在程序中检测不符合 json 格式, 请你帮忙处理为正确的 json 格式并返回，
只返回调整好的 json 文本即可，不要加入其他的说明和标识.
当前内容为：
` + content
                }
            ], {
                model: 'deepseek-chat',
                temperature: 1.0
            });
            return result.choices[0]?.message?.content || '';
        });

        return JSON.parse(v3response);
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
     * 完整工作流：从文件中提取内容，分析，并格式化结果
     * @param filePath 文件路径
     * @returns 格式化后的分析结果
     */
    public async executeWorkflow(filePath: string): Promise<string> {
        logger.info('开始执行工作流', { filePath });

        // 从文件中提取和分析内容
        // const analysisResults = await this.analyzeContentFromFile(filePath);
        const analysisResults = await this.convertToArticle(filePath);

        return analysisResults;
    }
}

// 导出单例
export const longTextToSimpleArticle = new LongTextToSimpleArticle();
