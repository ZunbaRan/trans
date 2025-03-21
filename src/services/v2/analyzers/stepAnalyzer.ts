import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../../utils/openaiClient';
import { SummaryAnalyzer } from './summaryAnalyzer';
import { ThinkingAnalyzer } from './thinkingAnalyzer';
import { AnalyzerUtils } from '../analyzerUtils';
import { FunnyAnalyzer } from './funnyAnalyzer';

interface AnalysisStep {
  name: string;
  promptFile: string;
  stepType: string;
}

export class StepAnalyzer {
  
  private readonly summaryAnalyzer: SummaryAnalyzer;
  private readonly thinkingAnalyzer: ThinkingAnalyzer;
  private readonly funnyAnalyzer: FunnyAnalyzer;

  constructor(
    private readonly logsDir: string
  ) {
    this.summaryAnalyzer = new SummaryAnalyzer(logsDir);
    this.thinkingAnalyzer = new ThinkingAnalyzer(logsDir);
    this.funnyAnalyzer = new FunnyAnalyzer(logsDir);
  }

  public async analyzeContent(
    content: string,
    theme: string
  ): Promise<{ [key: string]: string }> {
    // 执行总结分析
    console.log('开始执行总结分析...');
    const summaryResults = await this.summaryAnalyzer.analyzeSummary(content, theme);

    // 执行思考分析
    console.log('开始执行思考分析...');
    const thinkingResults = await this.thinkingAnalyzer.analyzeThinking(content, theme);

    // 执行幽默分析
    // console.log('开始执行幽默分析...');
    // const funnyResults = await this.funnyAnalyzer.analyzeFunny(content, theme);
    
    // 记录整体分析结果
    await AnalyzerUtils.logAnalysisResult(
      {
        theme,
        input: content,
        // output: `1.总结分析:\n${summaryResults}\n2.思考分析:\n${thinkingResults}\n3.幽默创作:\n${funnyResults}`,
        output: `1.总结分析:\n${summaryResults}\n2.思考分析:\n${thinkingResults}`,
        type: 'summary'
      },
      this.logsDir
    );

    return {
      summary_analysis: summaryResults,
      thinking_analysis: thinkingResults,
      // funny_analysis: funnyResults
    };
  }

  public async demo(
    path: string
  ): Promise<string> {
    const content = await fs.readFile(path, 'utf-8');
    const result = await openAIClient.executeWithFallback(async (client, model) => {
      return await openAIClient.chat([
        { role: "system", content: "请把用户输入的这段文字由 markdown 按结构转为 json " },
        { role: "user", content: content }
      ], {
        model: model,
        temperature: 0.3,
        frequency_penalty: 1,
        presence_penalty: 1
      });
    });
    return result.choices[0]?.message?.content || '';
  }
} 