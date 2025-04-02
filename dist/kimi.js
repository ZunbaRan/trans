"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kimiWebSearch = exports.KimiWebSearch = void 0;
var openai_1 = require("openai");
var logger_1 = require("./logger");
var logger = (0, logger_1.createModuleLogger)('kimi-search');
/**
 * Kimi 联网搜索客户端
 */
var KimiWebSearch = /** @class */ (function () {
    function KimiWebSearch(apiKey) {
        if (apiKey === void 0) { apiKey = process.env.MOONSHOT_API_KEY || ''; }
        this.client = new openai_1.OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.moonshot.cn/v1",
        });
    }
    /**
     * 执行联网搜索
     * @param query 搜索查询
     * @returns 搜索结果
     */
    KimiWebSearch.prototype.search = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var tools, messages, finishReason, finalContent, completion, choice, _i, _a, toolCall, toolCallName, toolCallArguments, toolResult, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        tools = [
                            {
                                "type": "builtin_function",
                                "function": {
                                    "name": "$web_search",
                                },
                            }
                        ];
                        messages = [
                            {
                                "role": "system",
                                "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。请提供准确、有帮助的回答。"
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ];
                        finishReason = null;
                        finalContent = '';
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        _b.label = 2;
                    case 2:
                        if (!(finishReason === null || finishReason === "tool_calls")) return [3 /*break*/, 4];
                        logger.info("\u53D1\u9001\u8BF7\u6C42\u5230 Kimi API\uFF0C\u5F53\u524D\u6D88\u606F\u6570: ".concat(messages.length));
                        return [4 /*yield*/, this.client.chat.completions.create({
                                model: "moonshot-v1-128k",
                                messages: messages,
                                temperature: 0.3,
                                tools: tools,
                            })];
                    case 3:
                        completion = _b.sent();
                        choice = completion.choices[0];
                        finishReason = choice.finish_reason;
                        if (finishReason === "tool_calls") {
                            // 添加助手消息到上下文
                            messages.push(choice.message);
                            // 处理工具调用
                            for (_i = 0, _a = choice.message.tool_calls || []; _i < _a.length; _i++) {
                                toolCall = _a[_i];
                                toolCallName = toolCall.function.name;
                                toolCallArguments = JSON.parse(toolCall.function.arguments);
                                if (toolCallName === "$web_search") {
                                    logger.info("\u6267\u884C $web_search \u641C\u7D22\uFF0C\u53C2\u6570: ".concat(JSON.stringify(toolCallArguments)));
                                    toolResult = toolCallArguments;
                                    // 添加工具结果到上下文
                                    messages.push({
                                        "role": "tool",
                                        "tool_call_id": toolCall.id,
                                        "name": toolCallName,
                                        "content": JSON.stringify(toolResult),
                                    });
                                }
                            }
                        }
                        else {
                            // 最终回答
                            finalContent = choice.message.content || '';
                            logger.info("\u641C\u7D22\u5B8C\u6210\uFF0C\u83B7\u5F97\u6700\u7EC8\u56DE\u7B54");
                        }
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/, finalContent];
                    case 5:
                        error_1 = _b.sent();
                        logger.error('Kimi 联网搜索失败', error_1);
                        throw new Error("Kimi \u8054\u7F51\u641C\u7D22\u5931\u8D25: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 流式执行联网搜索
     * @param query 搜索查询
     */
    KimiWebSearch.prototype.streamSearch = function (query) {
        return __asyncGenerator(this, arguments, function streamSearch_1() {
            var tools, messages, finishReason, completion, choice, _i, _a, toolCall, toolCallName, toolCallArguments, toolResult, _b, _c, _d, chunk, e_1_1, error_2;
            var _e, e_1, _f, _g;
            var _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        tools = [
                            {
                                "type": "builtin_function",
                                "function": {
                                    "name": "$web_search",
                                },
                            }
                        ];
                        messages = [
                            {
                                "role": "system",
                                "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。请提供准确、有帮助的回答。"
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ];
                        finishReason = null;
                        _k.label = 1;
                    case 1:
                        _k.trys.push([1, 20, , 21]);
                        _k.label = 2;
                    case 2:
                        if (!(finishReason === null || finishReason === "tool_calls")) return [3 /*break*/, 19];
                        logger.info("\u53D1\u9001\u6D41\u5F0F\u8BF7\u6C42\u5230 Kimi API\uFF0C\u5F53\u524D\u6D88\u606F\u6570: ".concat(messages.length));
                        return [4 /*yield*/, __await(this.client.chat.completions.create({
                                model: "moonshot-v1-128k",
                                messages: messages,
                                temperature: 0.3,
                                tools: tools,
                                stream: finishReason === null ? false : true,
                            }))];
                    case 3:
                        completion = _k.sent();
                        if (!(finishReason === null || finishReason === "tool_calls")) return [3 /*break*/, 4];
                        choice = completion.choices[0];
                        finishReason = choice.finish_reason;
                        if (finishReason === "tool_calls") {
                            // 添加助手消息到上下文
                            messages.push(choice.message);
                            // 处理工具调用
                            for (_i = 0, _a = choice.message.tool_calls || []; _i < _a.length; _i++) {
                                toolCall = _a[_i];
                                toolCallName = toolCall.function.name;
                                toolCallArguments = JSON.parse(toolCall.function.arguments);
                                if (toolCallName === "$web_search") {
                                    logger.info("\u6267\u884C $web_search \u641C\u7D22\uFF0C\u53C2\u6570: ".concat(JSON.stringify(toolCallArguments)));
                                    toolResult = toolCallArguments;
                                    // 添加工具结果到上下文
                                    messages.push({
                                        "role": "tool",
                                        "tool_call_id": toolCall.id,
                                        "name": toolCallName,
                                        "content": JSON.stringify(toolResult),
                                    });
                                }
                            }
                        }
                        return [3 /*break*/, 18];
                    case 4:
                        _k.trys.push([4, 11, 12, 17]);
                        _b = true, _c = (e_1 = void 0, __asyncValues(completion));
                        _k.label = 5;
                    case 5: return [4 /*yield*/, __await(_c.next())];
                    case 6:
                        if (!(_d = _k.sent(), _e = _d.done, !_e)) return [3 /*break*/, 10];
                        _g = _d.value;
                        _b = false;
                        chunk = _g;
                        if (!((_j = (_h = chunk.choices[0]) === null || _h === void 0 ? void 0 : _h.delta) === null || _j === void 0 ? void 0 : _j.content)) return [3 /*break*/, 9];
                        return [4 /*yield*/, __await(chunk.choices[0].delta.content)];
                    case 7: return [4 /*yield*/, _k.sent()];
                    case 8:
                        _k.sent();
                        _k.label = 9;
                    case 9:
                        _b = true;
                        return [3 /*break*/, 5];
                    case 10: return [3 /*break*/, 17];
                    case 11:
                        e_1_1 = _k.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 17];
                    case 12:
                        _k.trys.push([12, , 15, 16]);
                        if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 14];
                        return [4 /*yield*/, __await(_f.call(_c))];
                    case 13:
                        _k.sent();
                        _k.label = 14;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 16: return [7 /*endfinally*/];
                    case 17: return [3 /*break*/, 19];
                    case 18: return [3 /*break*/, 2];
                    case 19: return [3 /*break*/, 21];
                    case 20:
                        error_2 = _k.sent();
                        logger.error('Kimi 流式联网搜索失败', error_2);
                        throw new Error("Kimi \u6D41\u5F0F\u8054\u7F51\u641C\u7D22\u5931\u8D25: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                    case 21: return [2 /*return*/];
                }
            });
        });
    };
    return KimiWebSearch;
}());
exports.KimiWebSearch = KimiWebSearch;
// 导出单例实例
exports.kimiWebSearch = new KimiWebSearch();
// 简单使用示例
function demo() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.kimiWebSearch.search("请搜索2024年最新的人工智能发展趋势")];
                case 1:
                    result = _a.sent();
                    console.log("搜索结果:", result);
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error("搜索失败:", error_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// 如果直接运行此文件，则执行演示
if (require.main === module) {
    demo();
}
