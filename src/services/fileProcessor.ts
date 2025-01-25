import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import path from 'path';
import { ProcessMode } from '@/lib/types';
import { TextSplitter } from './textSplitter';
import { TextSentenceSplitter } from './textSentenceSplitter';
import { PromptTranslator } from './promptTranslator';
import { TextAnalyzer } from './textAnalyzer';

export class FileProcessor {
  private readonly openai: OpenAI;
  private readonly inputDir: string;
  private readonly outputDir: string;
  private readonly logsDir: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL
    });

    // 设置目录路径
    this.inputDir = path.join(process.cwd(), 'public/input');
    this.outputDir = path.join(process.cwd(), 'public/output');
    this.logsDir = path.join(process.cwd(), 'public/logs');
  }

  private async ensureDirectories() {
    // 确保目录存在
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  // 添加一个生成输出文件名的辅助方法
  private getOutputFileName(originalFileName: string, processMode: string, suffix: string = '.txt'): string {
    // 移除原始文件的扩展名
    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
    return `${baseName}_${processMode}${suffix}`;
  }

  // 添加获取输出路径的方法
  public getOutputPath(filename: string, mode: ProcessMode): string {
    const baseName = filename.replace(/\.[^/.]+$/, '');
    let outputFileName: string;

    switch (mode) {
      case 'text_split':
        outputFileName = `${baseName}_split.txt`;
        break;
      case 'text_trans_prompt':
        outputFileName = `${baseName}_translated.txt`;
        break;
      case 'text_sentence_split':
        outputFileName = `${baseName}_sentence_split.txt`;
        break;
      case 'text_split_trans_split':
        // 返回最终输出文件的路径
        outputFileName = `${baseName}_sentence_split.txt`;
        break;
      case 'text_analyze_summary':
        outputFileName = `${baseName}_analysis.md`;
        break;
      default:
        throw new Error(`Unsupported process mode: ${mode}`);
    }

    return path.join(this.outputDir, outputFileName);
  }

  public async processFile(filename: string, mode: ProcessMode): Promise<void> {
    await this.ensureDirectories();

    const inputPath = path.join(this.inputDir, filename);
    const content = await fs.readFile(inputPath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);

    switch (mode) {
      case 'text_split': {
        const splitter = new TextSplitter();
        const splitResult = splitter.process(lines);
        await fs.writeFile(
          this.getOutputPath(filename, mode),
          splitResult.join('\n\n')
        );
        break;
      }

      case 'text_trans_prompt': {
        const translator = new PromptTranslator(
          this.openai,
          this.getOutputPath(filename, mode),
          path.join(this.logsDir, 'translation.log')
        );
        const translations = await translator.translate(lines);
        await translator.writeResults(translations);
        break;
      }

      case 'text_sentence_split': {
        const splitter = new TextSentenceSplitter();
        const splitResult = splitter.process(lines);
        await fs.writeFile(
          this.getOutputPath(filename, mode),
          splitResult.join('\n\n')
        );
        break;
      }

      case 'text_split_trans_split': {
        // 1. 首先进行文本分割
        const splitter = new TextSplitter();
        const splitResult = splitter.process(lines);
        await fs.writeFile(
          this.getOutputPath(filename, 'text_split'),
          splitResult.join('\n\n')
        );

        // 2. 进行翻译
        const translator = new PromptTranslator(
          this.openai,
          this.getOutputPath(filename, 'text_trans_prompt'),
          path.join(this.logsDir, 'translation.log')
        );
        const translations = await translator.translate(splitResult);
        await translator.writeResults(translations);

        // 3. 对翻译结果进行中文句子分割
        const sentenceSplitter = new TextSentenceSplitter();
        const finalSplitResult = sentenceSplitter.process(translations);
        await fs.writeFile(
          this.getOutputPath(filename, mode),
          finalSplitResult.join('\n\n')
        );
        break;
      }

      case 'text_analyze_summary': {
        const analyzer = new TextAnalyzer(
          this.openai,
          this.getOutputPath(filename, mode),
          path.join(this.logsDir, 'analysis.log')
        );
        const analysisResults = await analyzer.analyze(content);
        await fs.writeFile(
          this.getOutputPath(filename, mode),
          analysisResults.join('\n\n---\n\n')
        );
        break;
      }

      default:
        throw new Error(`Unsupported process mode: ${mode}`);
    }
  }
}

// 导出一个单例实例
export const fileProcessor = new FileProcessor(); 