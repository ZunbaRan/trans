const { kimiWebSearch } = require('./kimi');

async function test() {
  try {
    const result = await kimiWebSearch.search("请搜索2024年最新的人工智能发展趋势");
    console.log("搜索结果:", result);
  } catch (error) {
    console.error("搜索失败:", error);
  }
}

test(); 