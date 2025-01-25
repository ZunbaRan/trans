'use client';

interface FilePreviewProps {
  title: string;
  content: string;
  isLoading?: boolean;
}

export default function FilePreview({ title, content, isLoading = false }: FilePreviewProps) {
  return (
    <div className="morandi-card h-full">
      {/* macOS 风格的标题栏 */}
      <div className="bg-morandi-overlay px-4 py-2 flex items-center space-x-2">
        <div className="flex space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-75" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-75" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-75" />
        </div>
        <span className="text-morandi-brown text-sm font-medium ml-2">{title}</span>
      </div>
      
      {/* 文件内容 */}
      <div className="flex-1 p-4 overflow-auto font-mono text-sm bg-white h-[calc(100%-2.5rem)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-morandi-blue" />
          </div>
        ) : content ? (
          <pre className="whitespace-pre-wrap break-words text-morandi-brown h-full">
            {content}
          </pre>
        ) : (
          <p className="text-center text-morandi-brown/50 py-8">
            No content to display
          </p>
        )}
      </div>
    </div>
  );
} 