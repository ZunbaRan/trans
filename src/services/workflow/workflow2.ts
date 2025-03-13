import * as fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '../utils/logger';
import { reviewArticleService } from './node/reviewArticle';
import { deepseekUtil } from '../utils/deepseekUtil';
import { openAIClient } from '../utils/openaiClient';

// 创建模块特定的日志记录器
const logger = createModuleLogger('workflow');

const articleLogger = createModuleLogger('article');

interface AnalysisResult {
    instruct: string;
    theme: string;
    reference: { start_line: number, end_line: number }[];
}


export class WorkflowService {

    private readonly promptDir: string = 'src/prompt/v4';
    private readonly logsDir: string = 'public/logs/flow2';
    private readonly firstPrompt: string = '01.md';
    private readonly secondPrompt: string = '02.md';


    /**
     * 从文件中提取内容并分析
     * @param filePath 文件路径
     * @returns 分析结果
     */
    public async analyzeContentFromFile(filePath: string): Promise<string> {
        console.info('开始从文件中提取和分析内容', { filePath });

        // 检查文件是否存在
        const absolutePath = await this.checkFileExists(filePath);

        // 读取文件内容
        const content = await this.readFile(absolutePath);

        // 把整个文章每一行前都加上 p1. p2 ..
        const contentWithLineNumber = content.trim().split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n');

        // 读取提示词模板
        const promptPath = path.join(process.cwd(), this.promptDir, this.firstPrompt);
        const firstPrompt = await fs.readFile(promptPath, 'utf-8');

        // 替换提示词模板中的占位符
        const finalPrompt = firstPrompt.replace('{$context}', contentWithLineNumber);

        // 调用 deepseekUtil 方法进行分析
        const response = await deepseekUtil.chat([
            { role: 'user', content: finalPrompt }
        ]);

        // 解析 response.choices[0].message.content 为 json 对象
        let analysisResults: AnalysisResult[];

        let responseContent = response.choices[0].message.content || '';
        // 如果存在 ```json，或者存在 ```，则提取 ```json 和 ``` 之间的内容，或者 ``` 和 ``` 之间的内容


        try {
            // 尝试从响应中提取 JSON
            const jsonRegex = /```(?:json)?([\s\S]*?)```/;
            const jsonMatch = responseContent.match(jsonRegex);

            if (jsonMatch && jsonMatch[1]) {
                // 从代码块中提取 JSON
                analysisResults = JSON.parse(jsonMatch[1].trim()) as AnalysisResult[];
            } else {
                // 尝试直接解析整个响应
                analysisResults = JSON.parse(responseContent) as AnalysisResult[];
            }
        } catch (error) {
            // 调用 DeepSeek v3 进行数据校对
            const v3response = await openAIClient.executeWithModel("deepseekV3", async (client, model) => {
                const result = await openAIClient.chat([
                    {
                        role: 'user', content: `
            当前内容在程序中检测不符合 json 格式, 请你帮忙处理为正确的 json 格式并返回，
            只返回调整好的 json 文本即可，不要加入其他的说明和标识.
            当前内容为：
            ` + response.choices[0].message.content
                    }
                ], {
                    model: 'deepseek-chat',  // 指定使用 DeepSeek V3 模型
                    temperature: 1.0
                });
                return result.choices[0]?.message?.content || '';
            });
            analysisResults = JSON.parse(v3response) as AnalysisResult[];
        }


        // 截取前3个元素,用来测试
        analysisResults = analysisResults.slice(0, 3);

        let current_text: string = '';

        for (const analysisResult of analysisResults) {

            // 根据 references数组 中的 start_line 和 end_line 截取文稿内容, 并且拼接成一个长文本
            let referenceText = '';
            for (const reference of analysisResult.reference) {
                // 把 reference.start_line 和 reference.end_line 转换为行号
                const startLine = reference.start_line;
                const endLine = reference.end_line;
                console.log('startLine', startLine);
                console.log('endLine', endLine);
                // 根据startLine和endLine按行截取
                const referenceParagraph = content.split('\n').slice(startLine - 1, endLine).join('\n');
                console.log('referenceParagraph', referenceParagraph);
                referenceText += referenceParagraph + '\n\n';
            }

            // 读取 02.md 提示词模板
            const promptPath = path.join(process.cwd(), this.promptDir, this.secondPrompt);
            const secondPrompt = await fs.readFile(promptPath, 'utf-8');

            // 替换提示词模板中的占位符
            let finalPrompt = secondPrompt.replace('{$reference_text}', referenceText)
                .replace('{$next_instruction}', analysisResult.instruct)

            // - 当前文章段落: {$current_text}
            // 如果是第一个元素, 则不需要添加当前文章段落
            if (analysisResult.reference.length > 0) {
                finalPrompt = finalPrompt.replace('{$current_text}', current_text);
            }

            // 调用 deepseekUtil 方法进行分析
            const response = await deepseekUtil.chat([
                { role: 'user', content: finalPrompt }
            ]);

            // 解析 response.choices[0].message.content 为 json 对象
            const result = response.choices[0].message.content || '';

            // 把 result 添加到 current_text 中
            current_text += result + '\n\n';
        }

        // 日志记录 currentContent
        await articleLogger.info(current_text);

        return current_text;
    }


    private async reviewArticleParagraphs(articleParagraphs: string[]) {
        // 调用 reviewArticleService 方法对 articleParagraphs 进行文章审查
        try {
            logger.info('开始对文章段落进行审查', { paragraphsCount: articleParagraphs.length });

            // 审查文章段落并获取审查结果
            const reviewResults = await reviewArticleService.reviewArticleParagraphs(articleParagraphs);

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
export const workflowService = new WorkflowService();
