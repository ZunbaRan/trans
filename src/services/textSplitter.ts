export class TextSplitter {
  /**
   * 判断文本是否以不完整的方式结束
   */
  private isIncompleteEnding(text: string): boolean {
    return text.endsWith('...') || 
           text.endsWith(',') || 
           text.endsWith(' and') || 
           text.endsWith(' or') ||
           text.endsWith('would') ||
           text.endsWith('will') ||
           text.endsWith('to') ||
           /[a-z]$/.test(text);
  }

  /**
   * 判断文本是否以小写字母开头（表示可能是上一句的延续）
   */
  private isLowercaseStart(text: string): boolean {
    return /^[a-z]/.test(text.trim());
  }

  /**
   * 在文本中查找第一个完整句子的结束位置
   * 返回位置索引，如果未找到则返回 -1
   */
  private findSentenceEnd(text: string): number {
    const matches = text.match(/[.!?]["\s]|[.!?]$/);
    return matches ? text.indexOf(matches[0]) + 1 : -1;
  }

  /**
   * 处理文本行
   * @param lines 输入的文本行数组
   * @returns 处理后的文本行数组
   */
  public process(lines: string[]): string[] {
    const result: string[] = [];
    let currentLine = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 跳过空行
      if (!line) {
        i++;
        continue;
      }

      // 如果当前没有待处理的行，直接使用这一行
      if (!currentLine) {
        currentLine = line;
        i++;
        continue;
      }

      // 检查当前行是否需要与下一行合并
      const shouldCombine = this.isIncompleteEnding(currentLine) || 
                          this.isLowercaseStart(line);

      if (shouldCombine) {
        // 查找下一行中可能的句子结束位置
        const endPos = this.findSentenceEnd(line);
        
        if (endPos !== -1) {
          // 找到了句子的结束位置，截取并合并
          const firstPart = line.slice(0, endPos).trim();
          const remainingPart = line.slice(endPos).trim();
          
          // 合并当前行和截取的第一部分
          result.push(currentLine + ' ' + firstPart);
          
          // 如果还有剩余部分，作为新的当前行
          currentLine = remainingPart;
        } else {
          // 没找到结束位置，整行合并
          currentLine += ' ' + line;
        }
      } else {
        // 不需要合并，保存当前行并开始新行
        result.push(currentLine);
        currentLine = line;
      }

      i++;
    }

    // 处理最后一行
    if (currentLine) {
      result.push(currentLine);
    }

    return result;
  }

  /**
   * 处理单个文本块
   * @param text 输入的文本块
   * @returns 处理后的文本行数组
   */
  public processText(text: string): string[] {
    const lines = text.split('\n');
    return this.process(lines);
  }
} 