import { deepGemini } from './deepGemini';
import { geminiClient, thinkingGeminiClient } from './geminiClient';
import { createModuleLogger } from './logger';
import { Message } from './baseClient';

const logger = createModuleLogger('test');

/**
 * 测试 DeepGemini 的对话功能
 * @param prompt 用户输入的提示词
 * @returns 处理结果
 */
export async function testDeepGemini(prompt: string) {
  try {
    logger.info('开始测试 DeepGemini 对话功能');

    // 构造消息
    const messages: Message[] = [
      { role: 'system', content: '你是一个有用的AI助手，擅长分析和解释复杂问题。' },
      { role: 'user', content: prompt }
    ];

    // 设置模型参数
    const modelArg = {
      temperature: 0.7,
      topP: 0.95,
      frequencyPenalty: 0,
      presencePenalty: 0
    };

    // 调用 DeepGemini 的对话方法
    logger.info('调用 DeepGemini 对话方法');
    const response = await deepGemini.chat(
      messages,
      modelArg,
      'deepseek-reasoner',  // DeepSeek 模型名称
      'gemini-2.0-flash'    // Gemini 模型名称
    );

    logger.info('DeepGemini 对话完成');

    // 提取结果
    const content = response.choices[0]?.message?.content || '';
    const reasoning = response.choices[0]?.message?.reasoning_content || '';

    return {
      success: true,
      content,
      reasoning,
      usage: response.usage
    };

  } catch (error) {
    logger.error('测试 DeepGemini 对话失败:', error);
    throw error;
  }
}

/**
 * 测试 Gemini 的对话功能
 * @param prompt 用户输入的提示词
 * @returns 处理结果
 */
export async function testGemini(prompt: string) {
  try {
    logger.info('开始测试 Gemini 对话功能');

    // 构造消息
    const messages: Message[] = [
      { role: 'system', content: '你是一个有用的AI助手，擅长分析和解释复杂问题。' },
      { role: 'user', content: prompt }
    ];

    // 调用 Gemini 的对话方法
    logger.info('调用 Gemini 对话方法');
    const response = await geminiClient.chat(messages, {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192
    });

    logger.info('Gemini 对话完成');

    // 提取结果
    const content = response.choices[0]?.message?.content || '';

    return {
      success: true,
      content,
      usage: response.usage
    };

  } catch (error) {
    logger.error('测试 Gemini 对话失败:', error);
    throw error;
  }
}

/**
 * 测试 ThinkingGemini 的对话功能
 * @param prompt 用户输入的提示词
 * @returns 处理结果
 */
export async function testThinkingGemini(prompt: string) {
  try {
    logger.info('开始测试 ThinkingGemini 对话功能');

    // 构造消息
    const messages: Message[] = [
      { role: 'system', content: '你是一个有用的AI助手，擅长分析和解释复杂问题。' },
      { role: 'user', content: prompt }
    ];

    // 调用 ThinkingGemini 的对话方法
    logger.info('调用 ThinkingGemini 对话方法');
    const response = await thinkingGeminiClient.chat(messages, {
      maxOutputTokens: 8192
    });

    logger.info('ThinkingGemini 对话完成');

    // 提取结果
    const content = response.choices[0]?.message?.content || '';

    return {
      success: true,
      content,
      usage: response.usage
    };

  } catch (error) {
    logger.error('测试 ThinkingGemini 对话失败:', error);
    throw error;
  }
}
