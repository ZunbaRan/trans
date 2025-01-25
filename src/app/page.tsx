'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ProcessForm from '@/components/ProcessForm';
import ProcessStatus from '@/components/ProcessStatus';
import FilePreview from '@/components/FilePreview';
import { ProcessMode } from '@/lib/types';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [processedContent, setProcessedContent] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleFileUploaded = (filename: string, content: string) => {
    setUploadedFile(filename);
    setFileContent(content);
    setStatus(`File "${filename}" uploaded successfully`);
  };

  const handleProcess = async (mode: ProcessMode) => {
    if (!uploadedFile) {
      setStatus('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setStatus(`Processing file with mode: ${mode}...`);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: uploadedFile, mode })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setStatus(`${result.message} - Mode: ${mode}`);
        // TODO: 获取处理后的文件内容
        setProcessedContent(result.content || '');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error processing file');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-[#F5F0E8]">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center text-morandi-brown">
          Subtitle Processor
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左列：上传和输入预览 */}
          <div className="flex flex-col h-full">
            {/* 文件上传区域 */}
            <div className="flex-1 bg-morandi-green-soft p-6 rounded-xl shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-morandi-brown mb-4">
                Upload File
              </h2>
              <FileUpload onFileUploaded={handleFileUploaded} />
              {/* 上传状态提示 */}
              {status.includes('uploaded') && (
                <div className="mt-4 text-sm text-morandi-green animate-fade-in">
                  {status}
                </div>
              )}
            </div>
            
            {/* 输入文件预览 */}
            <div className="flex-1 bg-morandi-green-light p-6 rounded-xl shadow-md">
              <h2 className="text-lg font-semibold text-morandi-brown mb-4">
                Input Preview
              </h2>
              <div className="h-[400px]">
                <FilePreview 
                  title={uploadedFile || 'No file selected'}
                  content={fileContent}
                />
              </div>
            </div>
          </div>

          {/* 右列：处理选项和输出预览 */}
          <div className="flex flex-col h-full">
            {/* 处理选项区域 */}
            <div className="flex-1 bg-morandi-blue-soft p-6 rounded-xl shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-morandi-brown mb-4">
                Process Options
              </h2>
              <ProcessForm 
                isDisabled={!uploadedFile || isProcessing}
                onProcess={handleProcess}
              />
              
              {/* 处理状态显示 - 只显示非上传状态 */}
              {status && !status.includes('uploaded') && (
                <div className="mt-4 bg-morandi-gray-light p-4 rounded-xl">
                  <ProcessStatus 
                    status={status}
                    isProcessing={isProcessing} 
                  />
                </div>
              )}
            </div>
            
            {/* 输出文件预览 */}
            <div className="flex-1 bg-morandi-brown-light p-6 rounded-xl shadow-md">
              <h2 className="text-lg font-semibold text-morandi-brown mb-4">
                Output Preview
              </h2>
              <div className="h-[400px]">
                <FilePreview 
                  title="Processing Result"
                  content={processedContent}
                  isLoading={isProcessing}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}