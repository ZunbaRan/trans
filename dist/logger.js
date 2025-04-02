"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleLogger = createModuleLogger;
var winston_1 = require("winston");
var path_1 = require("path");
var fs_1 = require("fs");
// 确保日志目录存在
var logDir = path_1.default.join(process.cwd(), 'public/logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// 创建格式化器
var customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(function (_a) {
    var level = _a.level, message = _a.message, timestamp = _a.timestamp, meta = __rest(_a, ["level", "message", "timestamp"]);
    var metaStr = Object.keys(meta).length ? "\n".concat(JSON.stringify(meta, null, 2)) : '';
    return "[".concat(timestamp, "] [").concat(level.toUpperCase(), "]: ").concat(message).concat(metaStr);
}));
// 创建 Winston 日志记录器
var logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: customFormat,
    transports: [
        // 控制台输出
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), customFormat)
        }),
        // 文件输出 - 错误日志
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error'
        }),
        // 文件输出 - 所有日志
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log')
        })
    ]
});
// 创建特定模块的日志记录器
function createModuleLogger(moduleName) {
    // 确保模块日志目录存在
    // 每一次的日志文件名都以当前时间命名
    var currentTime = new Date().toISOString().replace(/[-:Z]/g, '');
    var moduleLogDir = path_1.default.join(logDir, moduleName, "".concat(currentTime, ".log"));
    if (!fs_1.default.existsSync(moduleLogDir)) {
        fs_1.default.mkdirSync(moduleLogDir, { recursive: true });
    }
    return winston_1.default.createLogger({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: customFormat,
        defaultMeta: { module: moduleName },
        transports: [
            // 控制台输出
            new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), customFormat)
            }),
            // 文件输出 - 模块特定日志
            new winston_1.default.transports.File({
                filename: path_1.default.join(moduleLogDir, "".concat(moduleName, ".log"))
            }),
            // 文件输出 - 错误日志
            new winston_1.default.transports.File({
                filename: path_1.default.join(moduleLogDir, 'error.log'),
                level: 'error'
            })
        ]
    });
}
exports.default = logger;
