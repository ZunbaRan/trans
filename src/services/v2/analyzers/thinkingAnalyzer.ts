import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../openaiClient';
import { AnalyzerUtils } from '../utils/analyzerUtils';

interface ThinkingStep {
  name: string;
  promptFile: string;
  stepType: string;
}

export class ThinkingAnalyzer {
  private readonly thinkingSteps: ThinkingStep[] = [
    {
      name: '多维视角',
      promptFile: 'A_Mirror_of_Perspectives.md',
      stepType: 'perspectives'
    },
    {
      name: '思维激发',
      promptFile: 'Thought_Provoker.md',
      stepType: 'thought_provoking'
    },
    {
      name: '本质思考',
      promptFile: 'Essence.md',
      stepType: 'essence'
    },
    {
      name: '类比思考',
      promptFile: 'The_Bow_of_Analogy.md',
      stepType: 'analogy'
    },
    {
      name: '概念构建',
      promptFile: 'Concept_Construction.md',
      stepType: 'concept_construction'
    },
    {
      name: '沉思者',
      promptFile: 'Contemplator.md',
      stepType: 'contemplator'
    },
    {
      name: '质疑者',
      promptFile: 'The_Cone_of_Doubt.md',
      stepType: 'doubt'
    }
  ];

  constructor(
    private readonly logsDir: string
  ) {}

  public async analyzeThinking(
    content: string,
    theme: string
  ): Promise<string> {
    const thinkingResults: string[] = [];

    for (const step of this.thinkingSteps) {
      console.log(`执行思考步骤：${step.name}`);
      try {
        const result = await AnalyzerUtils.executeAnalysisStep(
          step,
          content,
          theme,
          'src/prompt/cn/thinking',
          this.logsDir,
          'thinking',
          async (prompt) => {
            const result = await openAIClient.executeWithFallback(async (client, model) => {
              return await openAIClient.chat([
                { role: "system", content: prompt },
                { role: "user", content: content }
              ], {
                model: model,
                temperature: 0.7
              });
            });
            return result.choices[0]?.message?.content || '';
          }
        );
        thinkingResults.push(AnalyzerUtils.formatAnalysisResult(step.name, result));
      } catch (error) {
        console.error(`${step.name}步骤失败:`, error);
        thinkingResults.push(
          AnalyzerUtils.formatAnalysisResult(
            step.name,
            `分析失败: ${error instanceof Error ? error.message : '未知错误'}`
          )
        );
      }
    }

    return AnalyzerUtils.combineResults('深度思考', thinkingResults);
  }
} 