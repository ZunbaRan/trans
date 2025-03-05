'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// 不要在这里导入 CSS，而是在客户端组件中导入
// import 'swagger-ui-react/swagger-ui.css';
// import 'swagger-ui-themes/themes/3.x/theme-material.css';

// 创建一个纯客户端组件
const ClientOnly = ({ children }) => {
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  if (!hasMounted) {
    return null; // 服务器端渲染时不返回任何内容
  }
  
  return <>{children}</>;
};

// 创建一个包含 Swagger UI 的客户端组件
const SwaggerUIComponent = dynamic(
  () => import('./swagger-component').then((mod) => mod.SwaggerUIComponent),
  { ssr: false }
);

export default function ApiDoc() {
  return (
    <ClientOnly>
      <SwaggerUIComponent />
    </ClientOnly>
  );
} 