'use client';

import { useState } from 'react';

interface FileUploadProps {
  onFileUploaded: (filename: string, content: string) => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 读取文件内容
      const content = await file.text();
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      onFileUploaded(data.filename, content);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${isDragging ? 'border-[var(--morandi-blue)] bg-[var(--morandi-blue)]/10' : 'border-[var(--morandi-brown)]/30'}
        ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
      }}
    >
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        id="fileInput"
        disabled={isUploading}
      />
      <label
        htmlFor="fileInput"
        className={`flex flex-col items-center ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isUploading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--morandi-blue)]" />
        ) : (
          <>
            <svg 
              className="w-8 h-8 mb-2 text-[var(--morandi-brown)]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <span className="text-[var(--morandi-brown)]">
              Click to upload or drag and drop
            </span>
            <span className="text-sm text-[var(--morandi-brown)]/60 mt-1">
              TXT files only
            </span>
          </>
        )}
      </label>
    </div>
  );
} 