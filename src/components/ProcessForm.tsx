'use client';

import { useState } from 'react';
import { ProcessMode } from '@/lib/types';

interface ProcessFormProps {
  isDisabled: boolean;
  onProcess: (mode: ProcessMode) => void;
}

const modeDescriptions: Record<ProcessMode, string> = {
  'text_split': '智能识别句子结尾来对英文长文本进行切割分行',
  'text_trans_prompt': '按行翻译英文文本，并进行润色',
  'text_sentence_split': '对中文文本进行换行切割',
  'text_split_trans_split': '串联执行"英文长文本切割" → "按行润色翻译" → "换行切割翻译后的文本"',
  'text_analyze_summary': '分析中文文本内容，提取主题、观点和关键信息，生成结构化总结'
};

export default function ProcessForm({ isDisabled, onProcess }: ProcessFormProps) {
  const [selectedMode, setSelectedMode] = useState<ProcessMode | ''>('');

  const handleProcess = () => {
    if (selectedMode) {
      onProcess(selectedMode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <select
          className={`w-full p-2.5 rounded-lg border transition-colors bg-white/80
            ${isDisabled 
              ? 'border-morandi-brown/20 text-morandi-brown/50 cursor-not-allowed' 
              : 'border-morandi-brown/30 hover:border-morandi-brown cursor-pointer'
            }`}
          value={selectedMode}
          onChange={(e) => setSelectedMode(e.target.value as ProcessMode)}
          disabled={isDisabled}
        >
          <option value="" disabled>Select Process Mode</option>
          <option value="text_split">Text Split</option>
          <option value="text_trans_prompt">Translate</option>
          <option value="text_sentence_split">Chinese Text Split</option>
          <option value="text_analyze_summary">Analyze & Summarize</option>
        </select>

        <button
          className={`w-full p-2.5 rounded-lg transition-colors
            ${isDisabled || !selectedMode
              ? 'bg-morandi-brown/20 text-morandi-brown/50 cursor-not-allowed'
              : 'bg-morandi-brown hover:bg-morandi-brown/90 text-white'
            }`}
          onClick={handleProcess}
          disabled={isDisabled || !selectedMode}
        >
          Process File
        </button>
      </div>

      {/* 模式说明 */}
      <div className="space-y-2 text-sm text-morandi-brown/80">
        {selectedMode && (
          <p>{modeDescriptions[selectedMode]}</p>
        )}
      </div>

      {/* 分隔线 */}
      <div className="border-t border-morandi-brown/10 pt-4">
        <h3 className="text-sm font-medium text-morandi-brown mb-2">
          Advanced Processing
        </h3>
        <button
          className={`w-full p-2.5 rounded-lg transition-colors bg-morandi-blue text-white
            ${isDisabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-morandi-blue/90'
            }`}
          onClick={() => onProcess('text_split_trans_split')}
          disabled={isDisabled}
        >
          Split + Translate + Split
        </button>
        <p className="mt-2 text-xs text-morandi-brown/70">
          {modeDescriptions['text_split_trans_split']}
        </p>
      </div>
    </div>
  );
} 