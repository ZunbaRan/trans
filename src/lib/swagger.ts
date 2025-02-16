import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: '内容分析 API 文档',
        version: '1.0.0',
        description: '用于内容分析的 API 接口文档',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: '开发环境',
        },
      ],
    },
  });
  return spec;
}; 