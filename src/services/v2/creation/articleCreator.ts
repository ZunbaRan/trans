import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../openaiClient';

export class ArticleCreator {
  private readonly normalPromptsDir = path.join(process.cwd(), 'src/prompt/cn/articles/normal');
  private readonly reasonPromptsDir = path.join(process.cwd(), 'src/prompt/cn/articles/reason');
  private readonly outputBaseDir = path.join(process.cwd(), 'public/output/articles');
  private readonly logsDir = path.join(process.cwd(), 'public/logs/articles');

  constructor() {}

  public async createArticle(userQuestion: string): Promise<{ 
    normal: string[]; 
    reason: string[]; 
    outputDir: string;
  }> {
    try {
      // 创建时间戳目录
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = path.join(this.outputBaseDir, timestamp);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.mkdir(this.logsDir, { recursive: true });

      // 并行执行 normal 和 reason 创作
      const [normalResults, reasonResults] = await Promise.all([
        this.createWithNormalModels(userQuestion, outputDir),
        this.createWithReasonerModels(userQuestion, outputDir)
      ]);

      // 记录结果
      await this.logResults(userQuestion, { normal: normalResults, reason: reasonResults });

      return {
        normal: normalResults,
        reason: reasonResults,
        outputDir
      };
    } catch (error) {
      console.error('文章创作失败:', error);
      throw error;
    }
  }

  private async createWithNormalModels(userQuestion: string, outputDir: string): Promise<string[]> {
    console.log('开始使用 normal 模型创作...');
    const results: string[] = [];

    try {
      const promptFiles = await fs.readdir(this.normalPromptsDir);
      const prompts = await Promise.all(
        promptFiles.map(async file => {
          const content = await fs.readFile(path.join(this.normalPromptsDir, file), 'utf-8');
          return { file: path.parse(file).name, content };
        })
      );

      const normalConfigs = await openAIClient.getNormalConfigs();

      for (const config of normalConfigs) {
        for (const { file, content } of prompts) {
          console.log(`使用 ${config.title} 模型和提示词文件: ${file}`);
          try {
            const result = await openAIClient.executeWithModel(
              config.title,
              async (client, model) => {
                const completion = await client.chat.completions.create({
                  model: model,
                  messages: [
                    { role: "system", content: content },
                    { role: "user", content: userQuestion }
                  ],
                  temperature: 0.6
                });
                return completion.choices[0]?.message?.content || '';
              }
            );
            
            // 写入文件
            const outputFileName = `${config.title}_${file}.md`;
            await fs.writeFile(
              path.join(outputDir, outputFileName),
              result,
              'utf-8'
            );
            
            results.push(result);
            console.log(`使用 ${config.title} 和 ${file} 创作完成，已保存到 ${outputFileName}`);
          } catch (error) {
            console.error(`使用 ${config.title} 和 ${file} 创作失败:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Normal 模型创作过程出错:', error);
    }

    return results;
  }

  private async createWithReasonerModels(userQuestion: string, outputDir: string): Promise<string[]> {
    console.log('开始使用 reasoner 模型创作...');
    const results: string[] = [];

    try {
      const promptFiles = await fs.readdir(this.reasonPromptsDir);
      const prompts = await Promise.all(
        promptFiles.map(async file => {
          const content = await fs.readFile(path.join(this.reasonPromptsDir, file), 'utf-8');
          return { 
            file: path.parse(file).name, 
            content: content.replace('{question}', userQuestion) 
          };
        })
      );

      const reasonerConfigs = await openAIClient.getReasonerConfigs();

      for (const config of reasonerConfigs) {
        for (const { file, content } of prompts) {
          console.log(`使用 ${config.title} 模型和提示词文件: ${file}`);
          try {
            const result = await openAIClient.executeWithReasoner(
              config.title,
              async (client, model) => {
                const completion = await client.chat.completions.create({
                  model: model,
                  messages: [
                    { role: "system", content: content },
                    { role: "user", content: userQuestion }
                  ],
                  temperature: 0.6
                });
                return completion.choices[0]?.message?.content || '';
              }
            );
            
            // 写入文件
            const outputFileName = `${config.title}_${file}.md`;
            await fs.writeFile(
              path.join(outputDir, outputFileName),
              result,
              'utf-8'
            );
            
            results.push(result);
            console.log(`使用 ${config.title} 和 ${file} 创作完成，已保存到 ${outputFileName}`);
          } catch (error) {
            console.error(`使用 ${config.title} 和 ${file} 创作失败:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Reasoner 模型创作过程出错:', error);
    }

    return results;
  }

  private async logResults(
    question: string, 
    results: { normal: string[]; reason: string[] }
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logContent = `
==================== 文章创作结果 ====================
时间：${new Date().toISOString()}
问题：${question}

Normal 模型创作结果：
${results.normal.map((result, index) => `
--- 结果 ${index + 1} ---
${result}
`).join('\n')}

Reasoner 模型创作结果：
${results.reason.map((result, index) => `
--- 结果 ${index + 1} ---
${result}
`).join('\n')}
================================================
`;

    await fs.writeFile(
      path.join(this.logsDir, `creation_${timestamp}.log`),
      logContent,
      'utf-8'
    );
  }
}

// 导出单例
export const articleCreator = new ArticleCreator(); 