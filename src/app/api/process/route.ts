import { NextRequest, NextResponse } from 'next/server';
import { ProcessRequest } from '@/lib/types';
import { fileProcessor } from '@/services/fileProcessor';
import fs from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, mode } = body as ProcessRequest;
    
    await fileProcessor.processFile(filename, mode);
    
    const outputPath = fileProcessor.getOutputPath(filename, mode);
    const outputContent = await fs.readFile(outputPath, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'File processed successfully',
      content: outputContent
    });
    
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Processing failed'
      },
      { status: 500 }
    );
  }
} 