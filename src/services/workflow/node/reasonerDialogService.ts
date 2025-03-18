import * as fs from 'fs/promises';
import path from 'path';
// deepseekutils
import { createModuleLogger } from '../../utils/logger';
import { tavilySearchUtil } from '../../utils/TavilySearchUtil';
import { webContentExtractor } from './webContentExtractor';
import { getRandomBanfo } from '../../utils/banfoSelector';
import { deepGemini } from '@/services/utils/deepGemini';
import { deepDoubao } from '@/services/utils/deepDoubao';

// 创建模块特定的日志记录器
const logger = createModuleLogger('reasoner-dialog');

const articleLogger = createModuleLogger('article');

// Ruler 返回的结构
interface RulerResponse {
  is_complete: 'yes' | 'no';
  next_instruction: string;
  // search_instruction: string;
  // reference_content: string;
}

interface DialogStep {
  round: number;
  speaker: 'ruler' | 'creator';
  content: string;
  // 添加结构化数据字段，用于 ruler 的响应
  structuredData?: RulerResponse;
}

interface DialogRecord {
  timestamp: string;
  topic: string;
  content: string;
  speaker: 'user' | 'ruler' | 'creator';
  // 添加结构化数据字段，用于 ruler 的响应
  structuredData?: RulerResponse;
}

export class ReasonerDialogService {
  private readonly logsDir: string;
  private readonly promptsDir: string = 'src/prompt/v3';
  private readonly historyDir: string = 'public/logs/reasoner_dialog_history';
  private readonly dialogLogsDir: string = 'public/logs/reasoner_dialogs';
  private readonly rulerPromptFile: string = '04_predictArticle.md';
  private readonly creatorPromptFile: string = '05_articleCreate.md';
  private readonly endWritePromptFile: string = '06_endWrite.md';
  private readonly maxRounds: number = 5;
  private readonly maxHistoryRounds: number = 5; // 最多保留的历史对话轮次
  private currentSessionDir: string = '';
  private currentHistoryFile: string = '';
  private currentRulerLogFile: string = '';
  private currentCreatorLogFile: string = '';

  constructor(logsDir: string) {
    this.logsDir = logsDir;
  }

  /**
   * 执行两个 reasoner 模型之间的对话
   * @param initialTopic 初始话题
   * @returns 对话历史记录
   */
  public async executeDialog(original_text: string, firstParagraph: string, isEnd: string = 'no'): Promise<string[]> {

    // 创建对话历史记录
    const dialogHistory: DialogStep[] = [];

    let articleParagraphs: string[] = [];

    // 初始化会话环境
    await this.initializeSession();

    // 读取提示词模板
    const rulerPrompt = await this.loadPrompt(this.rulerPromptFile);
    const creatorPrompt = await this.loadPrompt(this.creatorPromptFile);

    // 初始化对话，让 ruler 先发言
    let currentContent = firstParagraph;
    let finalContent = '';

    // 执行对话轮次
    for (let round = 1; round <= this.maxRounds; round++) {
      logger.info(`执行对话轮次 ${round}/${this.maxRounds}`);
      // 保存最初的 currentContent
      const initialContent = currentContent;

      // Ruler 回应 - 返回结构化数据
      const { textResponse: rulerTextResponse, structuredData: rulerStructuredData } =
        await this.executeRulerTurn(original_text, rulerPrompt, currentContent, round);

      // 添加到对话历史
      dialogHistory.push({
        round,
        speaker: 'ruler',
        content: rulerTextResponse,
        structuredData: rulerStructuredData
      });


      // RulerResponse 是 rulerStructuredData 的类型
      // 从 rulerStructuredData 中获取 is_complete 的值
      const isComplete = rulerStructuredData.is_complete;
      // 保存 is_complete 的值
      isEnd = rulerStructuredData.is_complete;
      // 如果判定为一篇完整的文章则中断循环
      if (isComplete === 'yes') {
        break;
      }

      // ruler 传递给  creator 的指令
      // const searchInstruction = rulerStructuredData.search_instruction;
      // const referenceContent = rulerStructuredData.reference_content;

      // 创建一个可变的 creatorPrompt
      let realCreatorPrompt = creatorPrompt;


      // // 默认情况下 第2轮 第3轮 第4轮 需要联网搜索
      // if (round == 2 || round == 3 || round == 4) {
      //   // # 续写主题的联网搜索内容
      //   const searchResult = await this.getSearchResult(searchInstruction, referenceContent);
      //   if (searchResult == '') {
      //     realCreatorPrompt = creatorPrompt;
      //   } else {
      //     realCreatorPrompt = creatorPrompt + '\n\n' + searchResult;
      //   }
      // }

      // 如果已经是最后一轮，则结束对话
      if (round === this.maxRounds) break;

      // creator 回应 - 返回文本
      const creatorResponse = await this.executeCreatorTurn(
        original_text,
        currentContent,
        realCreatorPrompt,
        rulerTextResponse,
        rulerStructuredData,
        round
      );

      // 添加到对话历史
      dialogHistory.push({
        round,
        speaker: 'creator',
        content: creatorResponse
      });

      // 把 creatorResponse 添加到 articleParagraphs 中
      articleParagraphs.push(creatorResponse);

      // 更新当前内容为 creator 的回应，作为下一轮 ruler 的输入
      // 要把 上一段的文章和续写的文章拼接起来
      currentContent = initialContent + creatorResponse;
      finalContent = initialContent + '\n\n' + creatorResponse;
    }

    // 日志记录 dialogHistory
    // await this.logDialogHistory(dialogHistory);

    return articleParagraphs;
  }

  /**
   * 初始化会话环境
   */
  private async initializeSession(): Promise<void> {
    // 创建会话目录和日志文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentSessionDir = path.join(this.dialogLogsDir, `session_${timestamp}`);

    // 确保目录存在
    await fs.mkdir(this.dialogLogsDir, { recursive: true });
    await fs.mkdir(this.historyDir, { recursive: true });
    await fs.mkdir(this.currentSessionDir, { recursive: true });

    // 创建模型日志文件和历史文件
    this.currentRulerLogFile = path.join(this.currentSessionDir, 'ruler.log');
    this.currentCreatorLogFile = path.join(this.currentSessionDir, 'creator.log');
    this.currentHistoryFile = path.join(this.historyDir, `history_${timestamp}.jsonl`);

    // 记录会话开始
    const sessionStartMsg = `开始执行 Reasoner 模型对话\n时间: ${new Date().toISOString()}`;
    await this.logToModelFile('ruler', sessionStartMsg);
    await this.logToModelFile('creator', sessionStartMsg);

    // 记录用户输入到历史
    // await this.appendToHistoryFile({
    //   timestamp: new Date().toISOString(),
    //   topic: initialTopic,
    //   content: initialTopic,
    //   speaker: 'user'
    // });

    logger.debug('会话环境初始化完成', {
      sessionDir: this.currentSessionDir,
      historyFile: this.currentHistoryFile
    });
  }

  public async endWrite(currentContent: string): Promise<string> {
    // 随机选择一个 banfo 文件
    const banfo = await getRandomBanfo();
    
    // 读取结束段落的提示词
    const endWritePrompt = await this.loadPrompt(this.endWritePromptFile);
    
    // 组装结束段落的输入
    const endWriteInput = endWritePrompt.replace('{$current_text}', currentContent)
      .replace('{$banfo}', banfo);
    // 执行结束段落的创作
    const endWriteResponse = await this.executeEndWriteTurn(endWriteInput);
    return endWriteResponse;
  }

  private async getSearchResult(searchInstruction: string, referenceContent: string): Promise<string> {
    try {
      // 执行搜索并提取内容
      const result = await tavilySearchUtil.searchAndExtract(
        searchInstruction,
        {
          searchDepth: 'basic',
          includeAnswer: true,
          extractDepth: 'basic',
          includeImages: false
        }
      );

      // 获取网页搜索的内容
      const extractedContents = result.extractedContents;

      // 提取实际内容集合
      const contents = extractedContents.results.map((item) => item.raw_content);

      let finalWebJsonl = '';
      // 循环contents
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        // 对 content 去掉网页 html等标签
        let contentRep = content.replace(/<[^>]*>?/g, '');

        // 如果 contentRep 太长超过 6000 字符，则截取前6000字符
        if (contentRep.length > 6000) {
          contentRep = contentRep.substring(0, 6000);
        }

        // 使用 WebContentExtractor 提取网页内容
        const webContent = await webContentExtractor.extractContent(referenceContent, contentRep);
        finalWebJsonl += webContent + '\n';
      }

      const searchTemplate = `
    # 以下内容是基于用户发送的消息的网络搜索结果, 可以参考网络搜索内容辅助创作。:
      {$search_results}
    `
      let searchResults = searchTemplate.replace('{$search_results}', finalWebJsonl);

      return searchResults;
    } catch (error) {
      logger.error('获取搜索结果失败', { error });
      return '';
    }
  }

  /**
   * 执行 Ruler 模型回合 - 处理结构化数据
   */
  private async executeRulerTurn(
    original_text: string,
    rulerPrompt: string,
    currentContent: string,
    round: number
  ): Promise<{ textResponse: string; structuredData: RulerResponse }> {
    // 记录轮次开始
    await this.logToModelFile('ruler', `\n--- 轮次 ${round}/${this.maxRounds} ---\n`);
    await this.logToModelFile('ruler', `输入:\n${currentContent}\n\n`);

    // 根据ruler的模板组装ruler的输入
    const rulerInput = rulerPrompt
      .replace('{$current_text}', currentContent)
      .replace('{$original_text}', original_text);

    // 构建消息
    const messages: any[] = [];

    messages.unshift({
      role: 'user',
      content: rulerInput
    });

    // 调用 DeepSeek 模型
    const response = await deepGemini.chat(messages);

    // 提取响应内容
    if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
      const error = new Error('API 响应格式不正确');
      logger.error('API 响应格式不正确', { error, round });
      throw error;
    }

    const responseContent = response.choices[0].message.content || '';

    // 记录 Ruler 的回应
    await this.logToModelFile('ruler', `输出:\n${responseContent}\n\n`);

    // 尝试解析 JSON 结构
    let structuredData: RulerResponse;

    try {
      // 尝试从响应中提取 JSON
      const jsonRegex = /```(?:json)?([\s\S]*?)```/;
      const jsonMatch = responseContent.match(jsonRegex);

      if (jsonMatch && jsonMatch[1]) {
        // 从代码块中提取 JSON
        structuredData = JSON.parse(jsonMatch[1].trim()) as RulerResponse;
      } else {
        // 尝试直接解析整个响应
        structuredData = JSON.parse(responseContent) as RulerResponse;
      }
    } catch (error) {

      try {
        // 如果 json 解析失败尝试直接从字符串中提取相应的字段， 然后设置到对象里返回
        // 提取 is_complete 的值
        const isComplete = responseContent.match(/is_complete: (yes|no)/)?.[1];
        // 提取 next_instruction 的值
        const nextInstruction = responseContent.match(/next_instruction: (.*)/)?.[1];


        // 如果提取的值不存在 则默认为空字符串
        structuredData = {
          is_complete: isComplete as 'yes' | 'no' || 'no',
          next_instruction: nextInstruction || '',
          // search_instruction: searchInstruction || '',
          // reference_content: referenceContent || ''
        };

        return {
          textResponse: responseContent,
          structuredData
        };
      } catch (error) {
        logger.error('解析 Ruler 响应为 JSON 失败', {
          error,
          responsePreview: responseContent.substring(0, 100) + '...'
        });
        throw error; // 直接抛出错误，终止执行
      }
    }

    // 记录 Ruler 的结构化数据到历史
    await this.appendToHistoryFile({
      timestamp: new Date().toISOString(),
      topic: rulerInput,
      content: responseContent,
      speaker: 'ruler',
      structuredData
    });

    return {
      textResponse: responseContent,
      structuredData
    };
  }

  /**
   * 执行 Creator 模型回合 - 处理文本响应
   */
  private async executeCreatorTurn(
    original_text: string,
    currentContent: string,
    creatorPrompt: string,
    rulerResponse: string,
    rulerStructuredData: RulerResponse,
    round: number
  ): Promise<string> {
    // 记录轮次开始
    
    await this.logToModelFile('creator', `\n--- 轮次 ${round}/${this.maxRounds} ---\n`);
    await this.logToModelFile('creator', `输入:\n${rulerResponse}\n\n`);
    
    // 随机选择一个 banfo 文件
    const banfo = await getRandomBanfo();
    
    const finalCreatorPrompt = creatorPrompt
      .replace('{$next_instruction}', rulerStructuredData.next_instruction)
      .replace('{$original_text}', original_text)
      .replace('{$current_text}', currentContent)
      .replace('{$banfo}', banfo);

    // 构建 Creator 的消息历史
    const messages: any[] = [];

    // 添加系统消息
    messages.unshift({
      role: 'user',
      content: finalCreatorPrompt
    });

    try {
      // 调用 DeepSeek 模型
      // round 单数轮次使用 doubao ，双数是使用 gemini
      const response = round % 2 === 0 ? await deepGemini.chat(messages) : await deepDoubao.chat(messages) ;
      // const response = await deepDoubao.chat(messages) ;
      
      // 添加防御性检查，确保 response 和 choices 存在
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('API 响应缺少 choices 数组');
      }

      if (!response.choices[0] || !response.choices[0].message) {
        throw new Error('API 响应缺少 message 字段');
      }

      // 提取响应内容
      const creatorResponse = response.choices[0].message.content || '';

      // 记录 Creator 的回应
      await this.logToModelFile('creator', `输出:\n${creatorResponse}\n\n`);

      // 记录 Creator 的回应到历史
      // await this.appendToHistoryFile({
      //   timestamp: new Date().toISOString(),
      //   topic: rulerResponse,
      //   content: creatorResponse,
      //   speaker: 'creator'
      // });

      return creatorResponse;
    } catch (error) {
      logger.error('执行 Creator 回合失败', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : String(error),
        round
      });
      throw error;
    }
  }


  /**
  * 执行 endWrite 模型回合 - 处理文本响应
  */
  private async executeEndWriteTurn(
    currentContent: string
  ): Promise<string> {

    await this.logToModelFile('endWrite', `\n--- --------------------- ---\n`);

    const messages: any[] = [];

    // 添加系统消息
    messages.unshift({
      role: 'user',
      content: currentContent
    });

    // 调用 DeepSeek 模型
    const response = await deepDoubao.chat(messages);

    // 提取响应内容
    const responseContent = response.choices[0]?.message?.content || '';

    // 记录 Creator 的回应
    await this.logToModelFile('creator', `输出:\n${responseContent}\n\n`);


    return responseContent;
  }


  /**
   * 记录会话结束
   */
  public async logSessionEnd(): Promise<void> {
    const endMsg = `\n对话结束\n时间: ${new Date().toISOString()}\n`;
    await this.logToModelFile('ruler', endMsg);
    await this.logToModelFile('creator', endMsg);
    logger.info('对话执行完成');
  }

  /**
   * 记录会话错误
   */
  private async logSessionError(error: any): Promise<void> {
    logger.error('执行 Reasoner 模型对话失败', { error });
    const errorMsg = `\n对话出错\n时间: ${new Date().toISOString()}\n错误: ${error instanceof Error ? error.message : '未知错误'}\n`;
    await this.logToModelFile('ruler', errorMsg);
    await this.logToModelFile('creator', errorMsg);
  }

  /**
   * 构建消息历史
   */
  private async buildMessageHistory(
    modelType: 'ruler' | 'creator'
  ): Promise<any[]> {
    const messages: any[] = [];

    // 从历史文件中加载最近的对话
    const historyRecords = await this.loadRecentHistory(this.maxHistoryRounds * 2); // 加载足够的历史记录

    if (historyRecords.length === 0) {
      return messages;
    }

    // 确保消息交替出现
    let lastRole: 'user' | 'assistant' | null = null;

    // 将历史记录转换为消息格式
    for (let i = 0; i < historyRecords.length; i++) {
      const record = historyRecords[i];

      // 确定角色
      let role: 'user' | 'assistant';

      if (record.speaker === 'user') {
        role = 'user';
      } else if (record.speaker === modelType) {
        role = 'assistant';
      } else {
        role = 'user'; // 另一个模型的回应作为用户输入
      }

      // 如果当前角色与上一个相同，则跳过
      if (lastRole === role) {
        logger.debug(`跳过连续的 ${role} 消息，确保消息交替`);
        continue;
      }

      // 添加消息
      messages.push({
        role: role,
        content: record.content
      });

      // 更新上一个角色
      lastRole = role;
    }

    // 确保最后一条消息是用户消息，如果不是则移除
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      messages.pop();
    }

    return messages;
  }

  /**
   * 记录到模型日志文件
   */
  private async logToModelFile(modelType: 'ruler' | 'creator' | 'endWrite', content: string): Promise<void> {
    try {
      const logFile = modelType === 'ruler' ? this.currentRulerLogFile : this.currentCreatorLogFile;
      await fs.appendFile(logFile, content, 'utf-8');
    } catch (error) {
      logger.error('记录到模型日志文件失败', { error, modelType });
    }
  }

  /**
   * 添加记录到历史文件
   */
  private async appendToHistoryFile(record: DialogRecord): Promise<void> {
    try {
      // 将记录转换为 JSON 行
      const jsonLine = JSON.stringify(record) + '\n';

      // 追加到当前历史文件
      // await fs.appendFile(this.currentHistoryFile, jsonLine, 'utf-8');
    } catch (error) {
      logger.error('添加记录到历史文件失败', { error });
    }
  }

  /**
   * 加载最近的历史记录
   */
  private async loadRecentHistory(count: number): Promise<DialogRecord[]> {
    try {
      // 检查文件是否存在
      try {
        await fs.access(this.currentHistoryFile);
      } catch {
        // 文件不存在，返回空数组
        return [];
      }

      // 读取文件内容
      const content = await fs.readFile(this.currentHistoryFile, 'utf-8');

      // 按行分割并解析 JSON
      const lines = content.trim().split('\n');
      const records: DialogRecord[] = [];

      // 从后向前读取指定数量的记录
      for (let i = Math.max(0, lines.length - count); i < lines.length; i++) {
        if (lines[i].trim()) {
          try {
            records.push(JSON.parse(lines[i]));
          } catch (e) {
            logger.error('解析历史记录行失败', { error: e, line: lines[i] });
          }
        }
      }

      return records;
    } catch (error) {
      logger.error('加载历史记录失败', { error });
      return [];
    }
  }

  /**
   * 加载提示词
   */
  private async loadPrompt(filename: string): Promise<string> {
    try {
      const promptPath = path.join(process.cwd(), this.promptsDir, filename);
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      logger.error(`提示词文件 ${filename} 不存在`, { error });
      throw new Error(`提示词文件 ${filename} 不存在`);
    }
  }

  /**
   * 获取当前会话目录路径
   */
  public getCurrentSessionDir(): string {
    return this.currentSessionDir;
  }

  /**
   * 获取当前历史文件路径
   */
  public getCurrentHistoryFile(): string {
    return this.currentHistoryFile;
  }

  /**
   * 获取当前 Ruler 日志文件路径
   */
  public getCurrentRulerLogFile(): string {
    return this.currentRulerLogFile;
  }

  /**
   * 获取当前 Creator 日志文件路径
   */
  public getCurrentCreatorLogFile(): string {
    return this.currentCreatorLogFile;
  }

  /**
   * 记录对话历史
   */
  private async logDialogHistory(dialogHistory: DialogStep[]): Promise<void> {
    try {
      const historyLogFile = path.join(this.currentSessionDir, 'dialog_history.json');
      await fs.writeFile(
        historyLogFile,
        JSON.stringify(dialogHistory, null, 2),
        'utf-8'
      );
      logger.info('对话历史已记录到文件', { historyLogFile });

    } catch (error) {
      logger.error('记录对话历史失败', { error });
    }
  }

  /**
   * 记录当前内容
   */
  private async logCurrentContent(content: string): Promise<void> {
    try {
      const contentLogFile = path.join(this.currentSessionDir, 'final_content.txt');
      await fs.writeFile(contentLogFile, content, 'utf-8');

      // 使用 logger 记录信息，而不是直接使用 console.log
      logger.info('最终内容已记录到文件', {
        contentLogFile,
        contentLength: content.length,
        sessionDir: this.currentSessionDir
      });

      // 记录内容摘要（仅记录前100个字符，避免日志过大）
      if (content) {
        const contentPreview = content.length > 100
          ? content.substring(0, 100) + '...'
          : content;
        logger.debug('内容摘要', { contentPreview });
      }
    } catch (error) {
      // 使用 logger 记录错误，而不是直接使用 console.error
      logger.error('记录最终内容失败', {
        error,
        sessionDir: this.currentSessionDir
      });
    }
  }
}

// 导出单例
export const reasonerDialogService = new ReasonerDialogService(
  path.join(process.cwd(), 'public/logs')
); 