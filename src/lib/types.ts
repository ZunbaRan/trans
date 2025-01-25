export type ProcessMode = 
  | 'text_split'
  | 'text_trans_prompt'
  | 'text_sentence_split'
  | 'text_split_trans_split'
  | 'text_analyze_summary';

export interface ProcessRequest {
  filename: string;
  mode: ProcessMode;
}

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
} 

// 定义类型
export interface ThemeBlock {
  theme: string;
  start_line: number;
  end_line: number;
}
