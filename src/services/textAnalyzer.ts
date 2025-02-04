import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import path from 'path';
import { ThemeBlock } from '@/lib/types';

export interface ThemeSection {
  theme: string;
  sections: { start_line: number; end_line: number; }[];
}

export class TextAnalyzer {
  private readonly logsDir: string;

  constructor(
    private readonly openai: OpenAI,
    private readonly outputPath: string,
    private readonly logPath: string,
    private readonly model: string
  ) {
    // 设置日志目录路径
    this.logsDir = path.join(process.cwd(), 'public/logs');
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

      // 2. 对每个段落进行分析并生成markdown
      console.log('开始详细内容分析...');
      const markdownResults = await Promise.all(
        themeBlocks.map(async (block, index) => {
          const { theme, sections } = block;
          console.log(`分析主题 ${index + 1}/${themeBlocks.length}: ${theme}`);
          
          // 收集该主题下的所有文本内容
          const blockContents = sections.map(section => {
            const sectionContent = lines.slice(section.start_line - 1, section.end_line).join('\n');
            return sectionContent;
          });
          
          // 合并该主题的所有内容
          const combinedContent = blockContents.join('\n\n');
          console.log(`主题 "${theme}" 包含 ${sections.length} 个文本段落`);
          // 打印combinedContent的行数
          console.log(`combinedContent的行数: ${combinedContent.split('\n').length}`);
          const prompt = this.createAnalysisPrompt(combinedContent);
          
          const analysisResult = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content: prompt
              },
              {
                role: "user",
                content: combinedContent
              }
            ],
            temperature: 0.3
          });

          const analysis = analysisResult.choices[0]?.message?.content || '';
          
          // 记录每个段落的分析结果
          await this.logAnalysisResult(theme, combinedContent, analysis);

          // 提取黄金句子
          const goldWordPrompt = await fs.readFile(path.join(process.cwd(), 'src/prompt/gold_word.md'), 'utf-8');
          const goldWordResult = await this.openai.chat.completions.create({
            model: this.model,
            messages: [{ role: 'system', content: goldWordPrompt }, { role: 'user', content: combinedContent }],
            temperature: 0.3
          });
          const goldWord = goldWordResult.choices[0]?.message?.content || '';
          console.log('goldWord:', goldWord);
          // 日志记录 goldWord
          await this.logGoldWord(theme, combinedContent, goldWord);

          // 替换无用的句子
          let goldWordTextReplace = '';
          // 如果 goldword 中有“匮乏才是创新的摇篮“这句，则将这句替换为空字符串
          if (goldWord.includes('匮乏才是创新的摇篮')) {
            goldWordTextReplace = goldWord.replace('匮乏才是创新的摇篮', '');
          }

          // 解析黄金句子
          let goldWordText = '';
          try {
            // 去除goldword 前后的非 json 字符串
            const jsonStart = goldWordTextReplace.indexOf('{');
            const jsonEnd = goldWordTextReplace.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
             const reGoldWord = goldWordTextReplace.substring(jsonStart, jsonEnd);
             const goldWordJson = JSON.parse(reGoldWord);
             goldWordText = goldWordJson.golden_sentences.map((item: { text: string }) => item.text).join('\n');
            }
          } catch (error) {
            console.error('解析金句JSON失败:', error);
            goldWordText = '';
          }
          // 生成markdown格式的段落分析，不再拼接原文
          return `## ${theme}\n\n${analysis}\n\n---\n\n### 金句\n\`\`\`text\n${goldWordText}\n\`\`\`\n\n---\n`;
        })
      );

      console.log('生成最终Markdown文档...');
      // 添加文档标题和简介
      const markdown = [
        '# 文本分析报告\n',
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
  private async logGoldWord(theme: string, combinedContent: string, goldWord: string) {
    const logContent = `
==================== 金句记录 ====================
时间：${new Date().toISOString()}
主题：${theme}

输入内容：
${combinedContent}

金句：
${goldWord}
================================================
\n`;
    await this.writeLog(path.join(this.logsDir, 'gold_word.log'), logContent);
  }

  private createAnalysisPrompt(content: string): string {
    return `你是一位拥有多年经验的内容分析师, 请分析深度以下文本内容，并使用Markdown格式按以下方面进行总结：

      ### 主题与核心观点
      - 主要论述的主题是什么
      - 核心观点和立场
        
      ### 论据与事实
      - 重要的论据
      - 关键的事实依据
      - 数据支撑
        
      ### 关键信息
      - 重要的概念
      - 关键的时间点
      - 重要的数据
        
      ### 逻辑结构
      - 论述的逻辑关系
      - 因果关联
      - 推理过程
        
      ### 相关引用
      > 请列出相关的原文引用（只列出关键句子），尽量多列出相关关键句子，并翻译为中文
      > 并列出原文引用对应的行号
        
      ### 总结
      简要总结该部分的核心内容
        
      文本内容：
${content}`;
  }

  // 分析内容查分段落
  private async analyzeContent(content: string, systemPrompt: string): Promise<ThemeSection[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.3
      });

      const result = completion.choices[0]?.message?.content?.trim() || '[]';
      console.log('textAnalyzer_analyzeContent_result:', result);

      try {
        // 移除 result 前的 "```json" 和 "```"
        const cleanResult = result.replace(/^```json\n|\n```$/g, '');
        const parsedResult = JSON.parse(cleanResult);
        
        // 验证解析后的数据结构
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
            sections: item.sections.map(section => ({
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
    // 确保 themeBlocks 是数组且不为空
    if (!Array.isArray(themeBlocks) || themeBlocks.length === 0) {
      console.warn('没有识别出主题块');
      const logContent = `
==================== 主题分段结果 ====================
时间：${new Date().toISOString()}
警告：没有识别出主题块
----------------------------------------\n`;
      await this.writeLog(
        path.join(this.logsDir, 'theme_blocks.log'),
        logContent
      );
      return;
    }

    console.log('themeBlocks:', themeBlocks);
    
    const logContent = `
==================== 主题分段结果 ====================
时间：${new Date().toISOString()}
识别主题数：${themeBlocks.length}

详细信息：
${themeBlocks.map((block, index) => `
主题 ${index + 1}: ${block.theme}
段落数：${block.sections?.length || 0}
段落范围：
${(block.sections || []).map(section => `  ${section.start_line}-${section.end_line}行`).join('\n')}
----------------------------------------`).join('\n')}
\n`;

    await this.writeLog(
      path.join(this.logsDir, 'theme_blocks.log'),
      logContent
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
    const logContent = `
==================== 错误记录 ====================
时间：${new Date().toISOString()}
错误类型：${error.name}
错误信息：${error.message}
堆栈跟踪：
${error.stack}
================================================
\n`;

    await this.writeLog(
      path.join(this.logsDir, 'error.log'),
      logContent
    );
  }
}