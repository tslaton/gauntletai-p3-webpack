import { StateGraph, START, END } from '@langchain/langgraph';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import PDFParser from 'pdf2json';
import MacOCR from '@cherrystudio/mac-system-ocr';
import { ChatOpenAI } from '@langchain/openai';
import { devLog, errorLog } from '../utils/logger';

// State definition
export interface PDFState {
  path: string;
  rawText?: string;
  meta?: {
    date: string;
    title: string;
    addressee: string;
  };
  error?: string;
  newPath?: string;
}

// Factory function to create pipeline with current configuration
export function createPDFPipeline(
  openaiApiKey: string, 
  llmModel: string, 
  useLowercase: boolean = true
) {
  // Create the model instance once for this pipeline
  const model = openaiApiKey ? new ChatOpenAI({
    modelName: llmModel || 'gpt-4.1-nano',
    temperature: 0,
    openAIApiKey: openaiApiKey,
  }) : null;

  // Graph nodes with configuration closure
  async function parsePDF(state: PDFState): Promise<Partial<PDFState>> {
    devLog('Parsing PDF:', state.path);
    
    try {
      // First try with pdf2json
      const text = await extractTextWithPDF2JSON(state.path);
      
      // If text is too short, use OCR
      if (text.trim().length < 20) {
        devLog('Text too short, using OCR fallback');
        const ocrText = await ocrPDF(state.path);
        return { rawText: ocrText };
      }
      
      return { rawText: text };
    } catch (error) {
      errorLog('Error parsing PDF:', error);
      return { error: `Failed to parse PDF: ${error}` };
    }
  }

  async function callLLM(state: PDFState): Promise<Partial<PDFState>> {
    if (!state.rawText) {
      devLog('LLM: No text to process');
      return { error: 'No text to process' };
    }
    
    if (!model) {
      devLog('LLM: OpenAI API key not configured, model is null');
      return { error: 'OpenAI API key not configured' };
    }
    
    devLog('Extracting metadata with LLM, text length:', state.rawText.length);
    
    try {
      const systemPrompt = `You are a parser that extracts three fields from documents:
- date (yyyy-mm-dd; today if absent)
- title (<= 8 words, no commas)
- addressee (first name only; blank if unknown)
Return JSON exactly like {"date":"...", "title":"...", "addressee":"..."}`;
      
      const userPrompt = `Document text follows \`\`\`
${state.rawText.slice(0, 12000)}
\`\`\``;
      
      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);
      
      const content = response.content.toString();
      const metadata = JSON.parse(content);
      
      return {
        meta: {
          date: metadata.date || new Date().toISOString().split('T')[0],
          title: (metadata.title || 'Untitled').slice(0, 100),
          addressee: (metadata.addressee || 'Unknown').slice(0, 50)
        }
      };
    } catch (error) {
      errorLog('LLM error:', error);
      return { error: `Failed to extract metadata: ${error}` };
    }
  }

  async function renameFile(state: PDFState): Promise<Partial<PDFState>> {
    if (!state.meta) {
      return { error: 'No metadata for renaming' };
    }
    
    devLog('Renaming file with metadata:', state.meta);
    
    try {
      const dir = path.dirname(state.path);
      let newName = `${state.meta.date} ${state.meta.title} [${state.meta.addressee}].pdf`;
      
      // Clean filename for filesystem
      let cleanName = newName.replace(/[<>:"/\\|?*]/g, '-');
      
      // Apply lowercase if configured
      if (useLowercase) {
        cleanName = cleanName.toLowerCase();
      }
      
      const newPath = path.join(dir, cleanName);
      
      // Check if file already exists
      if (fs.existsSync(newPath) && newPath !== state.path) {
        let counter = 1;
        let finalPath = newPath;
        while (fs.existsSync(finalPath)) {
          const base = path.basename(newPath, '.pdf');
          finalPath = path.join(dir, `${base} (${counter}).pdf`);
          counter++;
        }
        await fs.promises.rename(state.path, finalPath);
        return { newPath: finalPath };
      }
      
      await fs.promises.rename(state.path, newPath);
      return { newPath };
    } catch (error) {
      errorLog('Rename error:', error);
      return { error: `Failed to rename file: ${error}` };
    }
  }

  // Create the graph with channels
  const workflow = new StateGraph<PDFState, Partial<PDFState>>({
    channels: {
      path: null,
      rawText: null,
      meta: null,
      error: null,
      newPath: null,
    }
  });
  
  // Add nodes
  workflow.addNode('parse', parsePDF as any);
  workflow.addNode('llm', callLLM as any);
  workflow.addNode('rename', renameFile as any);
  
  // Add edges - define the flow
  workflow.addEdge(START, 'parse' as any);
  workflow.addEdge('parse' as any, 'llm' as any);
  workflow.addEdge('llm' as any, 'rename' as any);
  workflow.addEdge('rename' as any, END);
  
  // Compile and return
  return workflow.compile();
}

// Helper functions (shared across all instances)
async function extractTextWithPDF2JSON(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(errData.parserError);
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      let text = '';
      
      if (pdfData.Pages) {
        for (const page of pdfData.Pages) {
          if (page.Texts) {
            for (const textItem of page.Texts) {
              if (textItem.R) {
                for (const r of textItem.R) {
                  if (r.T) {
                    text += decodeURIComponent(r.T) + ' ';
                  }
                }
              }
            }
            text += '\n\n';
          }
        }
      }
      
      resolve(text);
    });
    
    pdfParser.loadPDF(filePath);
  });
}

async function ocrPDF(filePath: string): Promise<string> {
  // Check if running on macOS
  if (process.platform !== 'darwin') {
    throw new Error('OCR functionality is only available on macOS. Please ensure PDF files contain extractable text.');
  }
  
  try {
    devLog('Starting OCR process for:', filePath);
    
    // Import pdf2img-electron in main process
    const pdf2img = require('pdf2img-electron');
    const pdfData = pdf2img.default(filePath);
    devLog(`PDF loaded: ${pdfData.pages} pages`);
    
    // Convert to PNG buffers
    const imageBuffers = await pdfData.toPNG({ scale: 2.0 });
    devLog(`Got ${imageBuffers.length} images from PDF`);
    
    // Use macOS OCR on each image
    const ocrTexts: string[] = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      devLog(`Processing page ${i + 1} of ${imageBuffers.length}`);
      
      // Save image to temporary file for OCR
      const tempPath = path.join(os.tmpdir(), `ocr-temp-${Date.now()}-${i}.png`);
      await fs.promises.writeFile(tempPath, imageBuffers[i]);
      
      try {
        // OCR the image
        const result = await MacOCR.recognizeFromPath(tempPath);
        if (result && typeof result === 'string') {
          ocrTexts.push(result);
        } else if (result && typeof result === 'object' && 'text' in result) {
          ocrTexts.push((result as any).text);
        }
      } finally {
        // Clean up temp file
        try {
          await fs.promises.unlink(tempPath);
        } catch {}
      }
    }
    
    // Join all text from all pages
    const fullText = ocrTexts.join('\n\n');
    devLog(`OCR completed, extracted ${fullText.length} characters`);
    
    return fullText;
  } catch (error) {
    errorLog('OCR error:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

