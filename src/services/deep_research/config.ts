/**
 * 配置文件
 */

// 推荐使用 DeepSeek-R1 模型
export const REASONING_MODEL = process.env.REASONING_MODEL || "huoshan-DeepSeek-R1";

// 默认设置为 volc bot，如果使用 tavily，改为 "tavily"
export const SEARCH_ENGINE = process.env.SEARCH_ENGINE || "volc_bot";

// 可选，如果选择 tavily 作为搜索引擎，请配置此项
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "{YOUR_TAVILY_API_KEY}";

// 可选，如果选择 volc bot 作为搜索引擎，请配置此项
export const SEARCH_BOT_ID = process.env.SEARCH_BOT_ID || "{YOUR_SEARCH_BOT_ID}";

// 火山方舟 API KEY
export const ARK_API_KEY = process.env.ARK_API_KEY || "{YOUR_ARK_API_KEY}";

// Web UI 的 API 服务器地址
export const API_ADDR = process.env.API_ADDR || "https://ark.cn-beijing.volces.com/api/v3/bots";

// 使用远程 API 时，需要 bot id
export const API_BOT_ID = process.env.API_BOT_ID || "{YOUR_API_BOT_ID}"; 