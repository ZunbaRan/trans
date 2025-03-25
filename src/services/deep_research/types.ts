/**
 * 类型定义
 */

export interface ArkMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export interface ArkChatRequest {
  messages: ArkMessage[];
  model?: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface ArkChatResponseMessage {
  role: string;
  content: string;
  reasoning_content?: string;
}

export interface ArkChatResponseChoice {
  index: number;
  message: ArkChatResponseMessage;
  finish_reason: string;
}

export interface ArkChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ArkChatResponseChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ArkChatCompletionDelta {
  role?: string;
  content?: string;
  reasoning_content?: string;
}

export interface ArkChatCompletionChunkChoice {
  index: number;
  delta: ArkChatCompletionDelta;
  finish_reason?: string;
}

export interface ArkChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ArkChatCompletionChunkChoice[];
  metadata?: Record<string, any>;
} 