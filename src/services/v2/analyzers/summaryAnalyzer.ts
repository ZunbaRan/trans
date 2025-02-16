import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../openaiClient';
import { AnalyzerUtils } from '../utils/analyzerUtils';

interface SummaryStep {
  name: string;
  promptFile: string;
  stepType: string;
}

export class SummaryAnalyzer {
  private readonly summarySteps: SummaryStep[] = [
    {
      name: '内容分析',
      promptFile: 'setp1_Content_Analysis.md',
      stepType: 'content_analysis'
    },
    {
      name: '价值点提取',
      promptFile: 'step2_Value_Point_Extraction.md',
      stepType: 'value_points'
    },
    {
      name: '金句提取',
      promptFile: 'step3_gold_word.md',
      stepType: 'gold_words'
    }
  ];

  constructor(
    private readonly logsDir: string
  ) {}

  public async analyzeSummary(
    content: string,
    theme: string
  ): Promise<string> {
    const analysisResults: string[] = [];

    for (const step of this.summarySteps) {
      console.log(`执行总结步骤：${step.name}`);
      try {
        const result = await AnalyzerUtils.executeAnalysisStep(
          step,
          content,
          theme,
          'src/prompt/cn/summary',
          this.logsDir,
          'summary',
          async (prompt) => {
            const result = await openAIClient.executeWithFallback(async (client, model) => {
              const completion = await client.chat.completions.create({
                model: model,
                messages: [
                  { role: "system", content: prompt },
                  { role: "user", content: content }
                ],
                temperature: 0.3
              });
              return completion.choices[0]?.message?.content || '';
            });
            
            return result;
          }
        );
        analysisResults.push(AnalyzerUtils.formatAnalysisResult(step.name, result));
      } catch (error) {
        console.error(`${step.name}步骤失败:`, error);
        analysisResults.push(
          AnalyzerUtils.formatAnalysisResult(
            step.name,
            `分析失败: ${error instanceof Error ? error.message : '未知错误'}`
          )
        );
      }
    }
    return AnalyzerUtils.combineResults('总结分析', analysisResults);
  }

} 