import * as fs from 'fs/promises';
import path from 'path';
import { extractContentService } from './node/extractContent';
import { firstCreateService } from './node/firstCreate';
import { createModuleLogger } from '../utils/logger';
import { reasonerDialogService } from './node/reasonerDialogService';

// 创建模块特定的日志记录器
const logger = createModuleLogger('workflow');

interface AnalysisResult {
    theme: string;
    time_line: string;
    sections: string[];
}

export class WorkflowService {
    /**
     * 从文件中提取内容并分析
     * @param filePath 文件路径
     * @returns 分析结果
     */
    public async analyzeContentFromFile(filePath: string): Promise<string> {
        try {
            console.info('开始从文件中提取和分析内容', { filePath });

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

            // 读取文件内容
            console.debug('读取文件内容', { absolutePath });
            const content = await fs.readFile(absolutePath, 'utf-8');

            if (!content || content.trim() === '') {
                logger.warn('文件内容为空', { filePath });
                throw new Error(`文件内容为空: ${filePath}`);
            }

            console.info('文件内容读取成功', {
                filePath,
                contentLength: content.length
            });

            // 调用 extractAndAnalyze 方法进行分析
            const results = await extractContentService.extractAndAnalyze(content.trim());
            console.info('内容分析完成', {
                filePath,
                themesCount: results.length
            });

            // 返回结果为 AnalysisResult[] 获取第一个元素
            const result =
                results[0];
            // 文章的主题
            const theme = result.theme 

            // 调用 firstCreateService 方法进行创作
            const firstParagraph = await firstCreateService.createFirstParagraph(result);

            // 调用 reasonerDialogService 方法进行对话
            const dialogHistory = await reasonerDialogService.executeDialog(theme, firstParagraph);




            return dialogHistory;
        } catch (error) {
            logger.error('从文件中提取和分析内容失败', { error, filePath });
            throw error;
        }
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
        try {
            logger.info('开始执行工作流', { filePath });

            // 从文件中提取和分析内容
            const analysisResults = await this.analyzeContentFromFile(filePath);

            return analysisResults;
        } catch (error) {
            logger.error('执行工作流失败', { error, filePath });
            throw error;
        }
    }
}

// 导出单例
export const workflowService = new WorkflowService();
