import * as fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('banfo-selector');

/**
 * 随机选择一个 banfo 文件并返回其内容
 * @returns banfo 文件内容
 */
export async function getRandomBanfo(): Promise<string> {
  try {
    // banfo 文件的数量
    const banfoCount = 5;
    
    // 随机选择一个文件编号 (1-5)
    const randomNumber = Math.floor(Math.random() * banfoCount) + 1;
    
    // 构建文件路径
    const banfoPath = path.join(process.cwd(), `src/prompt/v3/banfo${randomNumber}.md`);
    
    logger.info(`随机选择了 banfo${randomNumber}.md 文件`);
    
    // 读取并返回文件内容
    return await fs.readFile(banfoPath, 'utf-8');
  } catch (error) {
    // 如果出错，回退到 banfo1.md
    logger.error('随机选择 banfo 文件失败，回退到 banfo1.md', { error });
    const fallbackPath = path.join(process.cwd(), 'src/prompt/v3/banfo1.md');
    return await fs.readFile(fallbackPath, 'utf-8');
  }
} 