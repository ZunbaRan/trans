const readline = require('readline');
const JSON5 = require('json5');

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 从字符串中提取 JSON
function extractJsonFromString(responseContent: string) {
  try {
    console.log('尝试解析输入字符串...');
    
    // 尝试从响应中提取 JSON
    const jsonRegex = /```(?:json)?([\s\S]*?)```/;
    const jsonMatch = responseContent.match(jsonRegex);

    let parsedData;
    let extractionMethod = '';

    if (jsonMatch && jsonMatch[1]) {
      // 从代码块中提取 JSON
      console.log('找到 JSON 代码块，从代码块中提取 JSON');
      const jsonString = jsonMatch[1].trim();
      console.log('提取的 JSON 字符串:');
      console.log('-----------------------------------');
      console.log(jsonString);
      console.log('-----------------------------------');
      
      try {
        parsedData = JSON.parse(jsonString);
        extractionMethod = '标准 JSON 解析';
      } catch (e) {
        console.log('标准 JSON 解析失败，尝试使用 JSON5 解析');
        parsedData = JSON5.parse(jsonString);
        extractionMethod = 'JSON5 解析';
      }
    } else {
      // 尝试直接解析整个响应
      console.log('未找到 JSON 代码块，尝试直接解析整个响应');
      try {
        parsedData = JSON.parse(responseContent);
        extractionMethod = '直接 JSON 解析';
      } catch (e) {
        console.log('直接 JSON 解析失败，尝试使用 JSON5 解析');
        parsedData = JSON5.parse(responseContent);
        extractionMethod = '直接 JSON5 解析';
      }
    }

    return {
      success: true,
      data: parsedData,
      method: extractionMethod
    };
  } catch (error) {
    console.error('解析 JSON 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      inputPreview: responseContent.substring(0, 100) + (responseContent.length > 100 ? '...' : '')
    };
  }
}

// 尝试修复常见的 JSON 格式问题
function attemptToFixJson(input: string): string {
  let result = input;
  
  // 1. 修复单引号替换为双引号 (但避免修改已经正确的转义单引号)
  result = result.replace(/(?<!\\)'/g, '"');
  
  // 2. 修复没有引号的键
  result = result.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  
  // 3. 修复尾随逗号
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  // 4. 修复缺少引号的字符串值
  // 这个比较复杂，简单实现
  result = result.replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2');
  
  return result;
}

// 测试 JSON 解析
async function testJsonParsing(input: string) {
  console.log('\n开始测试 JSON 解析，输入长度:', input.length);
  
  // 1. 尝试原始解析
  console.log('\n=== 原始解析 ===');
  const originalResult = extractJsonFromString(input);
  
  if (originalResult.success) {
    console.log('\n解析成功! 方法:', originalResult.method);
    console.log('\n解析后的数据:');
    console.log(JSON.stringify(originalResult.data, null, 2));
    return originalResult.data;
  }
  
  // 2. 如果原始解析失败，尝试修复常见问题
  console.log('\n=== 尝试修复 JSON 格式 ===');
  const fixedInput = attemptToFixJson(input);
  
  if (fixedInput !== input) {
    console.log('已尝试修复 JSON 格式问题');
    const fixedResult = extractJsonFromString(fixedInput);
    
    if (fixedResult.success) {
      console.log('\n修复后解析成功! 方法:', fixedResult.method);
      console.log('\n解析后的数据:');
      console.log(JSON.stringify(fixedResult.data, null, 2));
      return fixedResult.data;
    }
  }
  
  // 3. 如果修复后仍然失败，尝试提取任何看起来像 JSON 的部分
  console.log('\n=== 尝试提取部分 JSON ===');
  
  // 查找最外层的花括号
  const bracesMatch = input.match(/{[\s\S]*}/);
  if (bracesMatch) {
    const potentialJson = bracesMatch[0];
    console.log('找到潜在的 JSON 对象:', potentialJson.substring(0, 50) + '...');
    
    try {
      const partialData = JSON.parse(potentialJson);
      console.log('\n部分提取成功!');
      console.log('\n提取的数据:');
      console.log(JSON.stringify(partialData, null, 2));
      return partialData;
    } catch (error) {
      console.error('部分提取失败:', error);
    }
  }
  
  // 4. 最后尝试 - 查找数组
  const arrayMatch = input.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const potentialArray = arrayMatch[0];
    console.log('找到潜在的 JSON 数组:', potentialArray.substring(0, 50) + '...');
    
    try {
      const arrayData = JSON.parse(potentialArray);
      console.log('\n数组提取成功!');
      console.log('\n提取的数据:');
      console.log(JSON.stringify(arrayData, null, 2));
      return arrayData;
    } catch (error) {
      console.error('数组提取失败:', error);
    }
  }
  
  console.log('\n所有解析方法都失败了');
  return null;
}

// 主函数
async function main() {
  console.log('JSON 解析测试工具');
  console.log('-----------------------------------');
  console.log('这个工具测试从字符串中提取 JSON 的功能');
  console.log('特别适用于测试从 AI 响应中提取结构化数据');
  console.log('-----------------------------------');
  
  // 提示用户输入测试内容
  rl.question('\n请输入要解析的文本 (可以包含 ```json ... ``` 代码块):\n', async (input: string) => {
    try {
      await testJsonParsing(input);
    } catch (error) {
      console.error('测试过程中出错:', error);
    } finally {
      // 询问是否继续测试
      rl.question('\n是否继续测试? (y/n): ', (answer: string) => {
        if (answer.toLowerCase() === 'y') {
          rl.close();
          // 重新启动测试
          main();
        } else {
          console.log('测试结束');
          rl.close();
        }
      });
    }
  });
}

// 运行主函数
main().catch(error => {
  console.error('程序执行出错:', error);
  process.exit(1);
}); 