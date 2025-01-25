export class TextSentenceSplitter {
  // 判断是否是中文句子结尾
  private isChineseSentenceEnd(text: string): boolean {
    // 定义中文句子结束的标准标点符号
    const endMarks = ['。', '！', '？', '；', '：'];
    
    // 获取最后一个字符
    const lastChar = text.trim().slice(-1);
    
    // 检查是否以标点符号结尾
    return endMarks.includes(lastChar);
  }

  // 在标点符号处分割文本
  private splitAtPunctuation(text: string): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < text.length; i++) {
      currentSentence += text[i];
      
      // 检查当前字符是否是句子结尾
      if (this.isChineseSentenceEnd(currentSentence)) {
        sentences.push(currentSentence);
        currentSentence = '';
      }
    }

    // 处理剩余的文本
    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
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