import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../openaiClient';
import { AnalyzerUtils } from '../utils/analyzerUtils';

interface FunnyStep {
  name: string;
  promptFile: string;
  stepType: string;
}

export class FunnyAnalyzer {
  private readonly funnySteps: FunnyStep[] = [
    {
      name: '态度出发',
      promptFile: 'attitude_perspective.md',
      stepType: 'attitude'
    },
    {
      name: '洞察观点',
      promptFile: 'insight_viewpoint.md',
      stepType: 'insight'
    },
    {
      name: '解释',
      promptFile: 'explanation.md',
      stepType: 'explanation'
    },
    {
      name: '解决方案',
      promptFile: 'solution.md',
      stepType: 'solution'
    },
    {
      name: '真诚困境',
      promptFile: 'sincerity_dilemma.md',
      stepType: 'sincerity'
    },
    {
      name: '陌生场景',
      promptFile: 'unfamiliar_scenario.md',
      stepType: 'unfamiliar'
    },
    {
      name: '视角转换',
      promptFile: 'perspective_shift.md',
      stepType: 'perspective'
    },
    {
      name: '类比创作',
      promptFile: 'analogy_creation.md',
      stepType: 'analogy'
    },
    {
      name: 'What If',
      promptFile: 'what_if.md',
      stepType: 'what_if'
    },
    {
      name: '光明面',
      promptFile: 'bright_side.md',
      stepType: 'bright_side'
    },
    {
      name: '夸着骂',
      promptFile: 'ironic_praise.md',
      stepType: 'ironic'
    },
    {
      name: '类比式幽默',
      promptFile: 'analogical_humor.md',
      stepType: 'analogical'
    },
    {
      name: '自嘲式幽默',
      promptFile: 'self_deprecating_humor.md',
      stepType: 'self_deprecating'
    },
    {
      name: 'NBA结构',
      promptFile: 'nba_structure.md',
      stepType: 'nba'
    },
    {
      name: '嘴替',
      promptFile: 'mouth_substitute.md',
      stepType: 'substitute'
    },
    {
      name: '弱智风格',
      promptFile: 'silly_style.md',
      stepType: 'silly'
    },
    {
      name: '礼貌幽默',
      promptFile: 'polite_humor.md',
      stepType: 'polite'
    },
    {
      name: '搞笑角色',
      promptFile: 'funny_character.md',
      stepType: 'character'
    },
    {
      name: '合理化',
      promptFile: 'makes_sense.md',
      stepType: 'reasonable'
    }
  ];

  constructor(
    private readonly logsDir: string
  ) {}

  public async analyzeFunny(
    content: string,
    theme: string
  ): Promise<string> {
    const funnyResults: string[] = [];

    for (const step of this.funnySteps) {
      console.log(`执行幽默步骤：${step.name}`);
      try {
        const result = await AnalyzerUtils.executeAnalysisStep(
          step,
          content,
          theme,
          'src/prompt/cn/funny',
          this.logsDir,
          'funny',
          async (prompt) => {
            const result = await openAIClient.executeWithModel("doubao-pro-1.5", async (client, model) => {
              return await openAIClient.chat([
                { role: "system", content: prompt },
                { role: "user", content: content }
              ], {
                model: model,
                temperature: 0.8
              });
            });
            return result.choices[0]?.message?.content || '';
          }
        );
        funnyResults.push(AnalyzerUtils.formatAnalysisResult(step.name, result));
      } catch (error) {
        console.error(`${step.name}步骤失败:`, error);
        funnyResults.push(
          AnalyzerUtils.formatAnalysisResult(
            step.name,
            `分析失败: ${error instanceof Error ? error.message : '未知错误'}`
          )
        );
      }
    }
    return AnalyzerUtils.combineResults('幽默创作', funnyResults);
  }
} 