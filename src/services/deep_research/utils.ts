/**
 * 工具函数
 */

import { ArkChatCompletionChunk } from './types';

/**
 * 获取当前日期时间
 */
export function getCurrentDate(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 将content转换为reasoning_content
 */
export function castContentToReasoningContent(chunk: ArkChatCompletionChunk): ArkChatCompletionChunk {
  const newChunk = { ...chunk };
  if (newChunk.choices && newChunk.choices.length > 0) {
    newChunk.choices[0].delta = {
      ...newChunk.choices[0].delta,
      reasoning_content: newChunk.choices[0].delta.content,
      content: ''
    };
  }
  return newChunk;
}

/**
 * 生成带有元数据的chunk
 */
export function genMetadataChunk(metadata: Record<string, any>): ArkChatCompletionChunk {
  return {
    id: `chatcmpl-${Date.now().toString(16)}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'deep-research',
    choices: [{
      index: 0,
      delta: {
        role: 'assistant',
        content: '',
        reasoning_content: ''
      }
    }],
    metadata
  };
} 