import * as fs from 'fs/promises';
import path from 'path';

export interface LogContent {
  theme: string;
  input: string;
  output: string;
  type: 'summary' | 'thinking' | 'theme' | 'funny' | 'error';
}

export class AnalyzerUtils {
  /**
   * 格式化分析结果为Markdown格式
   */
  static formatAnalysisResult(title: string, content: string): string {
    return `### ${title}\n${content}\n`;
  }

  /**
   * 组合多个分析结果
   */
  static combineResults(title: string, results: string[]): string {
    return `## ${title}\n\n${results.join('\n')}\n---\n`;
  }

  /**
   * 记录分析结果到日志文件
   */
  static async logAnalysisResult(
    logContent: LogContent,
    logsDir: string
  ): Promise<void> {
    const typeLabels: Record<LogContent['type'], string> = {
      summary: '总结分析结果',
      thinking: '思考分析结果',
      theme: '主题分段结果',
      funny: '幽默分析结果',
      error: '错误记录'
    };

    const logFiles: Record<LogContent['type'], string> = {
      summary: 'summary_analysis.log',
      thinking: 'thinking_analysis.log',
      theme: 'theme_blocks.log',
      funny: 'funny_analysis.log',
      error: 'error.log'
    };

    const content = `
==================== ${typeLabels[logContent.type]} ====================
时间：${new Date().toISOString()}
主题：${logContent.theme}

输入内容：
${logContent.input}

分析结果：
${logContent.output}
================================================
\n`;

    try {
      // 确保日志目录存在
      await fs.mkdir(logsDir, { recursive: true });
      
      await fs.appendFile(
        path.join(logsDir, logFiles[logContent.type]),
        content,
        'utf-8'
      );
    } catch (error) {
      console.error(`写入${typeLabels[logContent.type]}日志失败:`, error);
    }
  }

  /**
   * 执行AI分析步骤的通用方法
   */
  static async executeAnalysisStep<T extends { name: string; promptFile: string; stepType: string }>(
    step: T,
    content: string,
    theme: string,
    promptDir: string,
    logsDir: string,
    logType: LogContent['type'],
    operation: (prompt: string) => Promise<string>
  ): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), promptDir, step.promptFile);
      const prompt = await fs.readFile(promptPath, 'utf-8');

      const analysis = await operation(prompt);

      // 记录分析结果
      await AnalyzerUtils.logAnalysisResult(
        {
          theme: `${theme} - ${step.stepType}`,
          input: content,
          output: analysis,
          type: logType
        },
        logsDir
      );

      return analysis;
    } catch (error) {
      console.error(`执行步骤 ${step.name} 失败:`, error);
      throw error;
    }
  }
} 