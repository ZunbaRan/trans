'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import 'swagger-ui-themes/themes/3.x/theme-material.css';

export function SwaggerUIComponent() {
  const [spec, setSpec] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 抑制 WebSQL 警告
    const originalConsoleWarn = console.warn;
    console.warn = function(...args) {
      // 过滤掉 WebSQL 相关的警告
      if (typeof args[0] === 'string' && args[0].includes('webSQL')) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };

    // 客户端获取 Swagger 规范
    fetch('/api/doc')
      .then(response => response.json())
      .then(data => {
        setSpec(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load API docs:', error);
        setIsLoading(false);
      });

    // 清理函数
    return () => {
      console.warn = originalConsoleWarn;
    };
  }, []);

  if (isLoading) {
    return <div>加载 API 文档中...</div>;
  }

  return (
    <div className="swagger-container">
      {spec && <SwaggerUI spec={spec} />}
      <style jsx global>{`
        .swagger-container {
          padding: 1rem;
          background: #fff;
        }
        .swagger-ui .topbar {
          display: none;
        }
      `}</style>
    </div>
  );
} 