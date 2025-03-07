import * as fs from 'fs/promises';
import path from 'path';
import { openAIClient } from '../utils/openaiClient';

interface DialogStep {
  round: number;
  speaker: 'model1' | 'model2';
  content: string;
}

interface DialogRecord {
  timestamp: string;
  topic: string;
  content: string;
  speaker: 'user' | 'model1' | 'model2';
}

export class ReasonerDialogService {
  private readonly logsDir: string;
  private readonly promptsDir: string = 'src/prompt/cn/reasoner_dialog';
  private readonly historyDir: string = 'public/logs/reasoner_dialog_history';
  private readonly dialogLogsDir: string = 'public/logs/reasoner_dialogs';
  private readonly model1PromptFile: string = 'model1_prompt.md';
  private readonly model2PromptFile: string = 'model2_prompt.md';
  private readonly maxRounds: number = 5;
  private readonly maxHistoryRounds: number = 5; // 最多保留的历史对话轮次
  private currentSessionDir: string = '';
  private currentHistoryFile: string = '';
  private currentModel1LogFile: string = '';
  private currentModel2LogFile: string = '';

  constructor(logsDir: string) {
    this.logsDir = logsDir;
  }

  /**
   * 执行两个 reasoner 模型之间的对话
   * @param initialTopic 初始话题
   * @returns 对话历史记录
   */
  public async executeDialog(initialTopic: string): Promise<DialogStep[]> {
    console.log(`开始执行 Reasoner 模型对话，初始话题: ${initialTopic}`);
    
    // 创建对话历史记录
    const dialogHistory: DialogStep[] = [];
    
    try {
      // 创建会话目录和日志文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentSessionDir = path.join(this.dialogLogsDir, `session_${timestamp}`);
      
      // 确保目录存在
      await fs.mkdir(this.dialogLogsDir, { recursive: true });
      await fs.mkdir(this.historyDir, { recursive: true });
      await fs.mkdir(this.currentSessionDir, { recursive: true });
      
      // 创建模型日志文件和历史文件
      this.currentModel1LogFile = path.join(this.currentSessionDir, 'model1.log');
      this.currentModel2LogFile = path.join(this.currentSessionDir, 'model2.log');
      this.currentHistoryFile = path.join(this.historyDir, `history_${timestamp}.jsonl`);
      
      // 记录会话开始
      await this.logToModelFile('model1', `开始执行 Reasoner 模型对话\n时间: ${new Date().toISOString()}\n初始话题: ${initialTopic}\n\n`);
      await this.logToModelFile('model2', `开始执行 Reasoner 模型对话\n时间: ${new Date().toISOString()}\n初始话题: ${initialTopic}\n\n`);
      
      // 记录用户输入到历史
      await this.appendToHistoryFile({
        timestamp: new Date().toISOString(),
        topic: initialTopic,
        content: initialTopic,
        speaker: 'user'
      });
      
      // 读取提示词模板
      const model1Prompt = await this.loadPrompt(this.model1PromptFile);
      const model2Prompt = await this.loadPrompt(this.model2PromptFile);
      
      // 初始化对话，让 model1 先发言
      let currentContent = initialTopic;
      
      // 执行对话轮次
      for (let round = 1; round <= this.maxRounds; round++) {
        console.log(`执行对话轮次 ${round}/${this.maxRounds}`);
        
        // Model1 回应
        await this.logToModelFile('model1', `\n--- 轮次 ${round}/${this.maxRounds} ---\n`);
        await this.logToModelFile('model1', `输入:\n${currentContent}\n\n`);
        
        // 构建 Model1 的消息历史
        const model1Messages = await this.buildMessageHistory('model1');
        
        const model1Response = await this.getModelResponse(
          'deepseek-r1',
          model1Prompt,
          currentContent,
          model1Messages
        );
        
        dialogHistory.push({
          round,
          speaker: 'model1',
          content: model1Response
        });
        
        // 记录 Model1 的回应
        await this.logToModelFile('model1', `输出:\n${model1Response}\n\n`);
        
        // 记录 Model1 的回应到历史
        await this.appendToHistoryFile({
          timestamp: new Date().toISOString(),
          topic: initialTopic,
          content: model1Response,
          speaker: 'model1'
        });
        
        // 如果已经是最后一轮，则结束对话
        if (round === this.maxRounds) break;
        
        // Model2 回应 Model1
        await this.logToModelFile('model2', `\n--- 轮次 ${round}/${this.maxRounds} ---\n`);
        await this.logToModelFile('model2', `输入:\n${model1Response}\n\n`);
        
        // 构建 Model2 的消息历史
        const model2Messages = await this.buildMessageHistory('model2');
        
        const model2Response = await this.getModelResponse(
          'deepseek-r1',
          model2Prompt,
          model1Response,
          model2Messages
        );
        
        dialogHistory.push({
          round,
          speaker: 'model2',
          content: model2Response
        });
        
        // 记录 Model2 的回应
        await this.logToModelFile('model2', `输出:\n${model2Response}\n\n`);
        
        // 记录 Model2 的回应到历史
        await this.appendToHistoryFile({
          timestamp: new Date().toISOString(),
          topic: initialTopic,
          content: model2Response,
          speaker: 'model2'
        });
        
        // 更新当前内容为 Model2 的回应，作为下一轮 Model1 的输入
        currentContent = model2Response;
      }
      
      // 记录对话结束
      await this.logToModelFile('model1', `\n对话结束\n时间: ${new Date().toISOString()}\n`);
      await this.logToModelFile('model2', `\n对话结束\n时间: ${new Date().toISOString()}\n`);
      
      return dialogHistory;
    } catch (error) {
      console.error('执行 Reasoner 模型对话失败:', error);
      const errorMsg = `\n对话出错\n时间: ${new Date().toISOString()}\n错误: ${error instanceof Error ? error.message : '未知错误'}\n`;
      await this.logToModelFile('model1', errorMsg);
      await this.logToModelFile('model2', errorMsg);
      throw error;
    }
  }
  
  /**
   * 构建消息历史
   */
  private async buildMessageHistory(
    modelType: 'model1' | 'model2'
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
        console.log(`跳过连续的 ${role} 消息，确保消息交替`);
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
   * 获取模型响应
   */
  private async getModelResponse(
    modelTitle: string,
    systemPrompt: string,
    userContent: string,
    messageHistory: any[]
  ): Promise<string> {
    try {
      // 替换提示词中的占位符
      const formattedPrompt = systemPrompt.replace('{$question}', userContent);
      
      // 检查最后一条消息的角色
      const lastMessage = messageHistory.length > 0 ? messageHistory[messageHistory.length - 1] : null;
      
      // 如果最后一条消息是用户消息，则移除它以避免连续的用户消息
      if (lastMessage && lastMessage.role === 'user') {
        console.log('移除最后一条用户消息，避免连续的用户消息');
        messageHistory.pop();
      }
      
      // 添加用户消息到历史
      messageHistory.push({ role: "user", content: formattedPrompt });
      
      // 调用 reasoner 模型
      const result = await openAIClient.executeWithReasoner(
        modelTitle,
        async (client, model) => {
          return await openAIClient.chat(messageHistory, {
            model: model,
            max_tokens: 8192
          });
        }
      );
      
      const responseContent = result.choices[0]?.message?.content || '无响应';
      
      // 添加助手回复到历史
      messageHistory.push({ role: "assistant", content: responseContent });
      
      return responseContent;
    } catch (error) {
      console.error(`获取模型 ${modelTitle} 响应失败:`, error);
      return `[模型响应失败: ${error instanceof Error ? error.message : '未知错误'}]`;
    }
  }
  
  /**
   * 记录到模型日志文件
   */
  private async logToModelFile(modelType: 'model1' | 'model2', content: string): Promise<void> {
    try {
      const logFile = modelType === 'model1' ? this.currentModel1LogFile : this.currentModel2LogFile;
      await fs.appendFile(logFile, content, 'utf-8');
    } catch (error) {
      console.error(`写入${modelType}日志失败:`, error);
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
      await fs.appendFile(this.currentHistoryFile, jsonLine, 'utf-8');
    } catch (error) {
      console.error('添加记录到历史文件失败:', error);
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
            console.error('解析历史记录行失败:', e);
          }
        }
      }
      
      return records;
    } catch (error) {
      console.error('加载历史记录失败:', error);
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
      console.log(`提示词文件 ${filename} 不存在，创建默认提示词文件...`);
      await this.createDefaultPromptFiles();
      
      // 重新尝试加载
      const promptPath = path.join(process.cwd(), this.promptsDir, filename);
      return await fs.readFile(promptPath, 'utf-8');
    }
  }
  
  /**
   * 创建默认提示词文件
   */
  private async createDefaultPromptFiles(): Promise<void> {
    try {
      // 确保目录存在
      await fs.mkdir(path.join(process.cwd(), this.promptsDir), { recursive: true });
      
      // 创建 Model1 提示词文件 - 使用新的格式
      const model1PromptContent = `你是一个富有哲学思维的思想家，擅长从不同角度思考问题，提出深刻的见解。
你的任务是与另一个模型进行对话，探讨各种话题。
请提出有深度的问题，分享你的独特见解，并对另一个模型的回应进行思考和回应。
保持友好、开放的态度，但不要害怕挑战对方的观点。
你的回应应该简洁明了，每次不超过200字。

以下是用户输入:
"""
{$question}
"""`;

      // 创建 Model2 提示词文件 - 使用新的格式
      const model2PromptContent = `你是一个实用主义者，擅长从现实和实践的角度思考问题。
你的任务是与另一个更偏哲学思维的模型进行对话，探讨各种话题。
请从实际应用、数据和经验的角度回应，提供具体的例子和解决方案。
你可以友好地质疑对方过于抽象的观点，但要保持尊重和建设性。
你的回应应该简洁明了，每次不超过200字。

以下是用户输入:
"""
{$question}
"""`;

      // 写入文件
      await fs.writeFile(
        path.join(process.cwd(), this.promptsDir, this.model1PromptFile),
        model1PromptContent
      );
      
      await fs.writeFile(
        path.join(process.cwd(), this.promptsDir, this.model2PromptFile),
        model2PromptContent
      );
      
      console.log('已创建默认提示词文件');
    } catch (error) {
      console.error('创建默认提示词文件失败:', error);
      throw error;
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
   * 获取当前模型1日志文件路径
   */
  public getCurrentModel1LogFile(): string {
    return this.currentModel1LogFile;
  }
  
  /**
   * 获取当前模型2日志文件路径
   */
  public getCurrentModel2LogFile(): string {
    return this.currentModel2LogFile;
  }
}

// 导出单例
export const reasonerDialogService = new ReasonerDialogService(
  path.join(process.cwd(), 'public/logs')
); 