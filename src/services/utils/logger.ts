import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'public/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建格式化器
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

// 创建 Winston 日志记录器
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    // 文件输出 - 错误日志
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // 文件输出 - 所有日志
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  ]
});

// 创建特定模块的日志记录器
export function createModuleLogger(moduleName: string) {
  // 确保模块日志目录存在
  // 每一次的日志文件名都以当前时间命名
  const currentTime = new Date().toISOString().replace(/[-:Z]/g, '');
  const moduleLogDir = path.join(logDir, moduleName, `${currentTime}.log`);
  if (!fs.existsSync(moduleLogDir)) {
    fs.mkdirSync(moduleLogDir, { recursive: true });
  }

  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: customFormat,
    defaultMeta: { module: moduleName },
    transports: [
      // 控制台输出
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
      }),
      // 文件输出 - 模块特定日志
      new winston.transports.File({ 
        filename: path.join(moduleLogDir, `${moduleName}.log`) 
      }),
      // 文件输出 - 错误日志
      new winston.transports.File({ 
        filename: path.join(moduleLogDir, 'error.log'), 
        level: 'error' 
      })
    ]
  });
}

export default logger; 