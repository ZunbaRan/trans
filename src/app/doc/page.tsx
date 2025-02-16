'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import 'swagger-ui-themes/themes/3.x/theme-material.css';

export default function ApiDoc() {
  return (
    <div className="swagger-container">
      <SwaggerUI url="/api/doc" />
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