export class TextSentenceSplitter {
  private readonly MIN_SENTENCE_LENGTH = 20;

  // 判断是否是中文句子结尾
  private isChineseSentenceEnd(text: string): boolean {
    const endMarks = ['。', '！', '？', '；', '：'];
    const lastChar = text.trim().slice(-1);
    return endMarks.includes(lastChar);
  }

  // 计算实际字数（不包括标点符号）
  private getCharCount(text: string): number {
    // 移除所有标点符号后计算长度
    const cleanedText = text.replace(/[。！？；：，、""''（）《》【】]/g, '');
    // 打印原句和长度
    console.log(`原句: ${cleanedText}, 长度: ${cleanedText.length}`);
    return cleanedText.length;
  }

  // 在标点符号处分割文本
  private splitAtPunctuation(text: string): string[] {
    const sentences: string[] = [];
    let currentSentence = '';
    let pendingSentence = ''; // 用于存储待处理的短句

    for (let i = 0; i < text.length; i++) {
      currentSentence += text[i];
      
      if (this.isChineseSentenceEnd(currentSentence)) {
        const trimmedCurrent = currentSentence.trim();
        
        // 如果有待处理的短句
        if (pendingSentence) {
          // 计算合并后的字数
          const combinedLength = this.getCharCount(pendingSentence + trimmedCurrent);
          
          if (combinedLength >= this.MIN_SENTENCE_LENGTH) {
            // 如果合并后达到最小长度，添加合并的句子
            sentences.push(pendingSentence + trimmedCurrent);
            pendingSentence = '';
          } else {
            // 如果合并后仍不够长，继续累积
            pendingSentence += trimmedCurrent;
          }
        } else {
          // 没有待处理的短句时，检查当前句子长度
          const currentLength = this.getCharCount(trimmedCurrent);
          
          if (currentLength >= this.MIN_SENTENCE_LENGTH) {
            // 如果当前句子够长，直接添加
            sentences.push(trimmedCurrent);
          } else {
            // 如果当前句子太短，加入待处理队列
            pendingSentence = trimmedCurrent;
          }
        }
        
        currentSentence = '';
      }
    }

    // 处理剩余的文本
    if (currentSentence.trim()) {
      const remaining = currentSentence.trim();
      
      if (pendingSentence) {
        // 如果有待处理的短句，与剩余文本合并
        sentences.push(pendingSentence + remaining);
      } else {
        // 否则直接添加剩余文本
        sentences.push(remaining);
      }
    } else if (pendingSentence) {
      // 如果只剩下待处理的短句，也要添加到结果中
      sentences.push(pendingSentence);
    }

    return sentences;
  }

  public process(lines: string[]): string[] {
    const result: string[] = [];
    let currentText = '';

    // 首先合并所有行
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      currentText += trimmed;
    }

    // 在标点符号处分割文本
    const sentences = this.splitAtPunctuation(currentText);

    // 过滤空行并添加到结果中
    sentences.forEach(sentence => {
      if (sentence.trim()) {
        result.push(sentence.trim());
      }
    });

    return result;
  }
} 