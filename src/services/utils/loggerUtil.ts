import * as fs from 'fs/promises';
import path from 'path';
import moment from 'moment';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('logger-util');

interface Message {
  role: string;
  content: string;
  [key: string]: any;
}

interface ApiResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
      [key: string]: any;
    };
    [key: string]: any;
  }>;
  [key: string]: any;
}

export class LogConversationUtil {
  /**
   * 记录API对话到日志文件
   * @param logDir 日志目录
   * @param messages 请求消息
   * @param response API响应
   * @param prefix 日志文件前缀
   */
  public static async logConversation(
    logDir: string,
    messages: Message[],
    response: ApiResponse | null,
    prefix: string = 'conversation'
  ): Promise<void> {
    try {
      // 确保日志目录存在
      await fs.mkdir(logDir, { recursive: true });

      const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
      const logFile = path.join(logDir, `${prefix}-${timestamp}.json`);

      // 安全地创建日志内容，避免循环引用
      const logContent = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        request: {
          messages: messages.map(m => ({ ...m })) // 创建消息的浅拷贝
        },
        response: response ? {
          id: response.id,
          model: response.model,
          choices: response.choices ? response.choices.map(c => ({
            index: c.index,
            message: c.message ? { ...c.message } : null,
            ...Object.entries(c)
              .filter(([key]) => key !== 'message' && key !== 'index')
              .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
          })) : null,
          ...Object.entries(response)
            .filter(([key]) => key !== 'choices' && key !== 'id' && key !== 'model')
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
        } : null
      };

      // 写入日志文件
      await fs.writeFile(logFile, JSON.stringify(logContent, null, 2), 'utf-8');
      return;
    } catch (error) {
      // 使用简单的错误记录，避免复杂对象
      logger.error('记录对话失败', error instanceof Error ? error.message : String(error));
    }
  }
} 