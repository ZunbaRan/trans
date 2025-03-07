import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../../utils/openaiClient';
import { AnalyzerUtils } from '../../utils/analyzerUtils';

interface SummaryStep {
  name: string;
  promptFile: string;
  stepType: string;
}

export class SummaryAnalyzer {
  private readonly summarySteps: SummaryStep[] = [
    // {
    //   name: '1.内容分析',
    //   promptFile: 'setp1_Content_Analysis.md',
    //   stepType: 'content_analysis'
    // },
    {
      name: '1.价值点提取',
      promptFile: 'step2_Value_Point_Extraction.md',
      stepType: 'value_points'
    },
    {
      name: '2.金句提取',
      promptFile: 'step3_gold_word.md',
      stepType: 'gold_words'
    }
  ];

  constructor(
    private readonly logsDir: string
  ) { }

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
              return await openAIClient.chat([
                { role: "system", content: prompt },
                { role: "user", content: content }
              ], {
                model: model,
                temperature: 0.3
              });
            });
            return result.choices[0]?.message?.content || '';
          });

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

    // 添加 reasoner 模型的全文总结
    // console.log('执行 Reasoner 模型总结...');
    // try {
    //   // 截取内容以确保不超过限制
    //   const truncatedContent = content.length > 30000 
    //     ? content.substring(0, 30000) + '...(内容已截断)'
    //     : content;

    //   const reasonerResult = await openAIClient.executeWithReasoner(
    //     'huoshan-DeepSeek-R1',
    //     async (client, model) => {
    //       return await openAIClient.chat([
    //         { 
    //           role: "system", 
    //           content: "你是一个专业的文章分析师。请对给定的文章进行深度总结，重点关注：\n1. 文章的核心观点和主要论述\n2. 作者的思维逻辑和论证方式\n3. 文章的创新点和独特见解" 
    //         },
    //         { role: "user", content: truncatedContent }
    //       ], {
    //         model: model,
    //         temperature: 0.3
    //       });
    //     }
    //   );

    //   analysisResults.push(
    //     AnalyzerUtils.formatAnalysisResult(
    //       '4.Reasoner深度总结',
    //       reasonerResult.choices[0]?.message?.content || ''
    //     )
    //   );
    // } catch (error) {
    //   console.error('Reasoner 模型总结失败:', error);
    //   analysisResults.push(
    //     AnalyzerUtils.formatAnalysisResult(
    //       '4.Reasoner深度总结',
    //       `分析失败: ${error instanceof Error ? error.message : '未知错误'}`
    //     )
    //   );
    // }

    return AnalyzerUtils.combineResults('总结分析', analysisResults);
  }

} 