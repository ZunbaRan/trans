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

const articleLogger = createModuleLogger('article');

interface AnalysisResult {
    theme: string;
    time_line: string;
    reference: { start_line: number, end_line: number }[];
}

interface AnalysisInstructionResult {
    instruct: string;
    theme: string;
    reference: { start_line: number, end_line: number }[];
}


export class WorkflowService {

    private readonly promptDir: string = 'src/prompt/long_text';
    private readonly logsDir: string = 'public/logs/flow2';
    private readonly firstPrompt: string = '01.md';
    private readonly secondPrompt: string = '02.md';
    private readonly thirdPrompt: string = '03.md';

    /**
     * 从文件中提取内容并分析，生成文章
     * @param filePath 文件路径
     * @returns 生成的文章内容
     */
    public async analyzeContentFromFile(filePath: string): Promise<string> {
        console.info('开始从文件中提取和分析内容', { filePath });

        // 1. 准备阶段：读取文件和提示词
        const content = await this.readFileWithLineNumbers(filePath);
        const firstPromptTemplate = await this.loadPromptTemplate(this.firstPrompt);
        const finalPrompt = firstPromptTemplate.replace('{$context}', content.numberedContent);

        // 2. 第一阶段：主题分析
        const analysisResults = await this.getThemeAnalysis(finalPrompt);

        // 测试阶段只处理第一个主题
        const limitedResults = analysisResults.slice(0, 1);

        // 3. 第二阶段：为每个主题生成文章
        let resArticle = '';
        for (const analysisResult of limitedResults) {
            const articleContent = await this.generateArticleForTheme(analysisResult, content.rawContent);
            resArticle += articleContent;
        }

        // 4. 第三阶段：审查文章
        const localReviewResults = await reviewArticleService.localReview(resArticle);
        const banfotyReviewResults = await reviewArticleService.banfotyReview(localReviewResults);
        const reviewResults = await reviewArticleService.deepbanfotyReview(banfotyReviewResults);

        const allResults = '#文章主题\n\n' + limitedResults[0].theme + '\n\n' +
            '## 第一次审查\n\n' + resArticle + '\n\n' + localReviewResults + '\n\n' +
            '## 第二次审查\n\n' + banfotyReviewResults + '\n\n' +
            '## 第三次审查\n\n' + reviewResults;


        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(process.cwd(), 'public/output', `article-original-${timestamp}.md`);

        // 确保输出目录存在
        await fs.mkdir(path.join(process.cwd(), 'public/output'), { recursive: true });

        // 写入文件
        await fs.writeFile(outputFile, allResults, 'utf-8');

        return allResults;
    }


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
        // 常规文风改编
        // const banfotyReviewResults = await reviewArticleService.banfotyReview(localReviewResults);

        // // 使用 deepseek 和 deepGemini 改编
        // const freeArticle = await reviewArticleService.deepbanfotyReview(localReviewResults);

        // const reviewResults = await reviewArticleService.reviewParagraph(banfotyReviewResults);

        const allResults =
            '## 直接生成文章 \n\n' + responseContent + '\n\n' +
            '## 结合简报和时间轴丰富内容\n\n' + enrichedArticle + '\n\n' +
            '## 本地化+深度\n\n' + localReviewResults + '\n\n' 
            // '## 常规文风改编\n\n' + banfotyReviewResults + '\n\n' +
            // '## 自由文风改编改编\n\n' + freeArticle;
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
     * 读取文件并为每行添加行号
     * @param filePath 文件路径
     * @returns 原始内容和带行号的内容
     */
    private async readFileWithLineNumbers(filePath: string): Promise<{ rawContent: string, numberedContent: string }> {
        // 检查文件是否存在
        const absolutePath = await this.checkFileExists(filePath);

        // 读取文件内容
        const content = await this.readFile(absolutePath);

        // 为每行添加行号
        const contentWithLineNumber = content.trim().split('\n')
            .map((line, index) => `${index + 1}. ${line}`)
            .join('\n');

        return {
            rawContent: content,
            numberedContent: contentWithLineNumber
        };
    }

    /**
     * 加载提示词模板
     * @param promptFileName 提示词文件名
     * @returns 提示词模板内容
     */
    private async loadPromptTemplate(promptFileName: string): Promise<string> {
        const promptPath = path.join(process.cwd(), this.promptDir, promptFileName);
        return await fs.readFile(promptPath, 'utf-8');
    }

    /**
     * 获取主题分析结果
     * @param prompt 包含内容的提示词
     * @returns 分析结果数组
     */
    private async getThemeAnalysis(prompt: string): Promise<AnalysisResult[]> {
        // 调用 AI 进行分析
        const response = await deepGemini.chat([
            { role: 'user', content: prompt }
        ]);

        const responseContent = response.choices[0].message.content || '';

        try {
            return this.parseJsonResponse(responseContent);
        } catch (error) {
            // 解析失败时使用备用模型修复 JSON
            return await this.fixJsonWithBackupModel(responseContent);
        }
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

    /**
     * 为特定主题生成文章内容
     * @param theme 主题分析结果
     * @param content 原始文件内容
     * @returns 生成的文章内容
     */
    private async generateArticleForTheme(theme: AnalysisResult, content: string): Promise<string> {
        console.log('处理主题:', theme.theme);
        console.log('时间线:', theme.time_line);
        console.log('引用段落:', theme.reference);

        // 1. 提取相关内容
        const referenceContent = this.extractReferenceContent(theme.reference, content);

        // 2. 获取写作指导
        const instructions = await this.getWritingInstructions(referenceContent);

        // 3. 根据指导生成文章
        return await this.generateArticleFromInstructions(instructions, content);
    }

    /**
     * 从原始内容中提取引用段落
     * @param references 引用段落范围数组
     * @param content 原始内容
     * @returns 带行号的引用内容
     */
    private extractReferenceContent(references: { start_line: number, end_line: number }[], content: string): string {
        let referenceContent = '';

        // 提取引用段落
        references.forEach(reference => {
            const startLine = reference.start_line;
            const endLine = reference.end_line;
            const paragraph = content.split('\n').slice(startLine - 1, endLine).join('\n');
            referenceContent += paragraph + '\n';
        });

        // 为引用内容添加行号
        return referenceContent.trim().split('\n')
            .map((line, index) => `${index + 1}. ${line}`)
            .join('\n');
    }

    /**
     * 获取写作指导
     * @param referenceContent 引用内容
     * @returns 写作指导数组
     */
    private async getWritingInstructions(referenceContent: string): Promise<AnalysisInstructionResult[]> {
        // 加载第二个提示词模板
        const secondPromptTemplate = await this.loadPromptTemplate(this.secondPrompt);
        const finalPrompt = secondPromptTemplate.replace('{$context}', referenceContent);

        // 调用 AI 获取写作指导
        const response = await deepGemini.chat([
            { role: 'user', content: finalPrompt }
        ]);

        const responseContent = response.choices[0].message.content || '';

        try {
            return this.parseJsonResponse(responseContent);
        } catch (error) {
            // 解析失败时使用备用模型修复 JSON
            return await this.fixJsonWithBackupModel(responseContent);
        }
    }

    /**
     * 根据写作指导生成文章
     * @param instructions 写作指导数组
     * @param content 原始内容
     * @returns 生成的文章内容
     */
    private async generateArticleFromInstructions(
        instructions: AnalysisInstructionResult[],
        content: string
    ): Promise<string> {
        let articleContent = '';

        // 加载第三个提示词模板
        const thirdPromptTemplate = await this.loadPromptTemplate(this.thirdPrompt);

        // 为每个指导生成对应的文章段落
        for (const instruction of instructions) {
            // 提取引用文本
            const referenceText = this.extractReferenceContent(instruction.reference, content);

            // 构建提示词
            let finalPrompt = thirdPromptTemplate
                .replace('{$reference_text}', referenceText)
                .replace('{$next_instruction}', instruction.instruct);

            // 添加当前文章段落上下文（如果有）
            if (instruction.reference.length > 0) {
                finalPrompt += `
                - 当前文章段落: ${articleContent}
                `;
            }

            // 调用 AI 生成文章段落
            const response = await deepGemini.chat([
                { role: 'user', content: finalPrompt }
            ]);

            // 添加到文章内容
            const result = response.choices[0].message.content || '';
            articleContent += result + '\n\n';
        }

        // 记录生成的文章内容
        await articleLogger.info(articleContent);

        return articleContent;
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
export const workflowService = new WorkflowService();
