import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from './openaiClient';
import { StepAnalyzer } from './analyzers/stepAnalyzer';
import { AnalyzerUtils } from './utils/analyzerUtils';

export interface ThemeSection {
  theme: string;
  sections: { start_line: number; end_line: number; }[];
}

interface Section {
  start_line: string | number;
  end_line: string | number;
}

export class ContentAnalyzer {
  private readonly logsDir: string;
  private readonly stepAnalyzer: StepAnalyzer;

  constructor(
    private readonly outputPath: string,
    private readonly logPath: string
  ) {
    this.logsDir = path.join(process.cwd(), 'public/logs');
    this.stepAnalyzer = new StepAnalyzer(this.logsDir);
  }

  // 确保日志目录存在
  private async ensureLogsDir(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      console.error('创建日志目录失败:', error);
      throw error;
    }
  }

  // 写入日志的通用方法
  private async writeLog(filePath: string, content: string): Promise<void> {
    try {
      await this.ensureLogsDir();
      await fs.appendFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`写入日志失败 (${filePath}):`, error);
    }
  }

  async analyze(content: string): Promise<string[]> {
    try {
      console.log('开始分析文本...');
      
      // 去掉 content 中的空行，然后按行加上序号在行首
      const lines = content
        .split('\n')
        .filter(line => line.trim() !== '') // 过滤掉空行
        .map((line, index) => `[P${index + 1}] ${line}`); // 加上序号
      const text = lines.join('\n');
      console.log(`处理文本行数: ${lines.length}`);

      // 读取系统提示
      const systemPrompt = await fs.readFile(path.join(process.cwd(), 'src/prompt/analyze_theme_split.md'), 'utf-8');
      console.log('已加载系统提示模板');
      
      // 1. 分析内容分段落
      console.log('开始主题分段分析...');
      const themeBlocks = await this.analyzeContent(text, systemPrompt);
      console.log(`识别出 ${themeBlocks.length} 个主题段落`);
      
      // 记录主题分段结果
      await this.logThemeBlocks(themeBlocks);

      // 2. 对每个段落进行三步分析并生成markdown
      console.log('开始详细内容分析...');
      const markdownResults = await Promise.all(
        themeBlocks.map(async (block, index) => {
          const { theme, sections } = block;
          console.log(`分析主题 ${index + 1}/${themeBlocks.length}: ${theme}`);
          
          // 收集该主题下的所有文本内容
          const blockContents = sections.map((section: Section) => {
            const sectionContent = lines.slice(Number(section.start_line) - 1, Number(section.end_line)).join('\n');
            return sectionContent;
          });
          
          // 合并该主题的所有内容
          const combinedContent = blockContents.join('\n\n');
          console.log(`主题 "${theme}" 包含 ${sections.length} 个文本段落`);
          console.log(`combinedContent的行数: ${combinedContent.split('\n').length}`);
          
          // 执行所有分析步骤并获取结果
          const results = await this.stepAnalyzer.analyzeContent(combinedContent, theme);
          
          // 将对象中的值合并为字符串数组
          const resultArray = Object.values(results).map(value => value);
          
          // 格式化结果
          return AnalyzerUtils.combineResults(theme, resultArray);

          })
      );

      console.log('生成最终Markdown文档...');
      // 添加文档标题和目录
      const markdown = [
        '# 内容分析报告\n',
        '## 目录\n',
        ...themeBlocks.map(block => `- [${block.theme}](#${block.theme.toLowerCase().replace(/\s+/g, '-')})\n`),
        '\n---\n',
        ...markdownResults
      ];

      console.log('分析完成！');
      return markdown;

    } catch (error) {
      console.error('分析过程出错:', error);
      await this.logError(error);
      throw error;
    }
  }

  private async analyzeContent(content: string, systemPrompt: string): Promise<ThemeSection[]> {
    try {
      const result = await openAIClient.executeWithFallback(async (client, model) => {
        return await openAIClient.chat([
          { role: "system", content: systemPrompt },
          { role: "user", content: content }
        ], {
          model: model,
          temperature: 0.3
        });
      });

      // 详细打印结果
      console.log('AI Response:', {
        content: result.choices[0]?.message?.content,
        role: result.choices[0]?.message?.role,
      });

      try {
        const cleanResult = result.choices[0]?.message?.content?.trim() || '[]';
        
        // 如果返回的是markdown格式的JSON，去掉markdown标记
        const jsonContent = cleanResult.replace(/^```json\n|\n```$/g, '').trim();

        const parsedResult = JSON.parse(jsonContent);
        
        if (!Array.isArray(parsedResult)) {
          console.error('解析结果不是数组:', parsedResult);
          return [];
        }

        const themeBlocks: ThemeSection[] = parsedResult.map(item => {
          if (!item.theme || !Array.isArray(item.sections)) {
            console.error('无效的主题块结构:', item);
            return {
              theme: item.theme || '未知主题',
              sections: []
            };
          }
          return {
            theme: item.theme,
            sections: item.sections.map((section: Section) => ({
              start_line: Number(section.start_line) || 1,
              end_line: Number(section.end_line) || 1
            }))
          };
        });

        await this.logAnalysis(content, JSON.stringify(themeBlocks, null, 2));
        return themeBlocks;

      } catch (parseError) {
        console.error('JSON解析错误:', parseError);
        console.error('原始响应:', result);
        return [];
      }

    } catch (error) {
      console.error('AI请求错误:', error);
      return [];
    }
  }

  private async logThemeBlocks(themeBlocks: ThemeSection[]): Promise<void> {
    if (!themeBlocks?.length) {
      await AnalyzerUtils.logAnalysisResult(
        {
          theme: '主题分段失败',
          input: '无输入内容',
          output: '分析失败：未能识别出任何主题段落',
          type: 'theme'
        },
        this.logsDir
      );
      return;
    }

    const detailedInfo = themeBlocks.map((block, index) => `
主题 ${index + 1}: ${block.theme}
段落数：${block.sections?.length || 0}
段落范围：
${(block.sections || []).map(section => `  ${section.start_line}-${section.end_line}行`).join('\n')}
----------------------------------------`).join('\n');

    await AnalyzerUtils.logAnalysisResult(
      {
        theme: '主题分段结果',
        input: `识别主题数：${themeBlocks.length}`,
        output: detailedInfo,
        type: 'theme'
      },
      this.logsDir
    );
  }

  private async logAnalysisResult(theme: string, input: string, output: string): Promise<void> {
    const logContent = `
==================== 段落分析结果 ====================
时间：${new Date().toISOString()}
主题：${theme}

输入内容：
${input}

分析结果：
${output}
================================================
\n`;

    await this.writeLog(
      path.join(this.logsDir, 'analysis_details.log'),
      logContent
    );
  }

  private async logAnalysis(input: string, output: string): Promise<void> {
    const logContent = `
==================== GPT响应结果 ====================
时间：${new Date().toISOString()}
输入：
${input}

分析结果：
${output}
----------------------------------------
\n`;

    await this.writeLog(this.logPath, logContent);
  }

  private async logError(error: any): Promise<void> {
    await AnalyzerUtils.logAnalysisResult(
      {
        theme: '错误记录',
        input: error.name || '未知错误类型',
        output: `错误信息：${error.message}\n堆栈跟踪：\n${error.stack}`,
        type: 'error'
      },
      this.logsDir
    );
  }
} 