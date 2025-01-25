import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import path from 'path';

export class PromptTranslator {
  private readonly openai: OpenAI;
  private readonly outputPath: string;
  private readonly logFile: string;
  private systemPrompt: string = '';

  constructor(openai: OpenAI, outputPath: string, logFile: string) {
    this.openai = openai;
    this.outputPath = outputPath;
    this.logFile = logFile;
  }

  private async logTranslation(message: string, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logMessage = `
[${timestamp}] ${message}
${data ? JSON.stringify(data, null, 2) : ''}
----------------------------------------
`;
    try {
      await fs.appendFile(this.logFile, logMessage);
      console.log(message);
    } catch (err) {
      console.error('Failed to write to translation log:', err);
    }
  }

  private async loadPrompt(): Promise<void> {
    try {
      this.systemPrompt = await fs.readFile(
        path.join(process.cwd(), 'src', 'prompt', 'trans.md'),
        'utf-8'
      );
      await this.logTranslation('Loaded system prompt');
    } catch (error) {
      await this.logTranslation('Error loading prompt:', error);
      throw error;
    }
  }

  private async retransWord(translation: string): Promise<string> {
    const retransPrompt = await fs.readFile(path.join(process.cwd(), 'src/prompt/retrans_word.md'), 'utf-8');
    const retrans = await this.openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: retransPrompt }, { role: 'user', content: translation }],
      temperature: 0.3
    });
    const retransResult = retrans.choices[0].message.content?.trim() || '';
    await this.logTranslation('二次润色结果:', {
      input: translation,
      output: retransResult
    });
    return retransResult;
  }

  private async translateLine(line: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: "system",
            content: this.systemPrompt
          },
          {
            role: "user",
            content: line
          }
        ],
        temperature: 0.3
      });

      const translation = completion.choices[0].message.content?.trim() || '[Translation failed]';
      
      await this.logTranslation('Line translation completed:', {
        input: line,
        output: translation
      });

      return translation;
    } catch (error) {
      await this.logTranslation('Translation error:', error);
      return '[Translation failed]';
    }
  }

  public async translate(content: string[]): Promise<string[]> {
    try {
      await this.loadPrompt();
      
      const lines = content
        .map(line => line.trim())
        .filter(Boolean);

      await this.logTranslation('Starting translation:', {
        totalLines: lines.length
      });

      // 将lines分成多个批次，每批10个
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < lines.length; i += batchSize) {
        batches.push(lines.slice(i, i + batchSize));
      }

      const allResults: string[] = [];
      
      // 逐批处理
      for (const batch of batches) {
        // 并发处理每一批的翻译
        const batchTranslations = await Promise.all(
          batch.map(async (line, index) => {
            console.log(`Translating line ${index + allResults.length + 1}/${lines.length}`);
            const translation = await this.translateLine(line);
            
            await this.logTranslation('Translation progress:', {
              completedLines: index + allResults.length + 1,
              totalLines: lines.length,
              percentComplete: (((index + allResults.length + 1) / lines.length) * 100).toFixed(2) + '%'
            });

            return translation;
          })
        );

        // 并发处理每一批的二次润色
        const batchRetrans = await Promise.all(
          batchTranslations.map(translation => this.retransWord(translation))
        );

        allResults.push(...batchRetrans);
      }

      return allResults;
    } catch (error) {
      await this.logTranslation('Translation process error:', error);
      throw error;
    }
  }

  public async writeResults(results: string[]): Promise<void> {
    try {
      const output = results.join('\n\n');
      await fs.writeFile(this.outputPath, output);
      await this.logTranslation('Results written to file:', {
        outputPath: this.outputPath,
        translatedLines: results.length
      });
    } catch (error) {
      await this.logTranslation('Error writing results:', error);
      throw error;
    }
  }
}