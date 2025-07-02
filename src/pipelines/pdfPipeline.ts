import { StateGraph } from '@langchain/langgraph';
import fs from 'node:fs';
import path from 'node:path';
import PDFParser from 'pdf2json';
import MacOCR from '@cherrystudio/mac-system-ocr';
import { ChatOpenAI } from '@langchain/openai';
import { pdfToPng } from 'pdf-to-png-converter';

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
export function createPDFPipeline(openaiApiKey: string, llmModel: string, useLowercase: boolean = true) {
  // Create the model instance once for this pipeline
  const model = openaiApiKey ? new ChatOpenAI({
    modelName: llmModel || 'gpt-4.1-nano',
    temperature: 0,
    openAIApiKey: openaiApiKey,
  }) : null;

  // Graph nodes with configuration closure
  async function parsePDF(state: PDFState): Promise<Partial<PDFState>> {
    console.log('Parsing PDF:', state.path);
    
    try {
      // First try with pdf2json
      const text = await extractTextWithPDF2JSON(state.path);
      
      // If text is too short, use OCR
      if (text.trim().length < 20) {
        console.log('Text too short, using OCR fallback');
        const ocrText = await ocrPDF(state.path);
        return { rawText: ocrText };
      }
      
      return { rawText: text };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return { error: `Failed to parse PDF: ${error}` };
    }
  }

  async function callLLM(state: PDFState): Promise<Partial<PDFState>> {
    if (!state.rawText) {
      return { error: 'No text to process' };
    }
    
    if (!model) {
      return { error: 'OpenAI API key not configured' };
    }
    
    console.log('Extracting metadata with LLM');
    
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
      console.error('LLM error:', error);
      return { error: `Failed to extract metadata: ${error}` };
    }
  }

  async function renameFile(state: PDFState): Promise<Partial<PDFState>> {
    if (!state.meta) {
      return { error: 'No metadata for renaming' };
    }
    
    console.log('Renaming file with metadata:', state.meta);
    
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
      console.error('Rename error:', error);
      return { error: `Failed to rename file: ${error}` };
    }
  }

  // Create the graph
  const workflow = new StateGraph<PDFState>({
    channels: {
      path: null,
      rawText: null,
      meta: null,
      error: null,
      newPath: null,
    }
  });
  
  // Add nodes
  workflow.addNode('parse', parsePDF);
  workflow.addNode('llm', callLLM);
  workflow.addNode('rename', renameFile);
  
  // Add edges - define the flow
  workflow.addEdge('__start__', 'parse');
  workflow.addEdge('parse', 'llm');
  workflow.addEdge('llm', 'rename');
  workflow.addEdge('rename', '__end__');
  
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
  try {
    const pages = await pdfToPng(filePath, {
      disableFontFace: true,
      useSystemFonts: true,
      viewportScale: 2.0,
    });
    
    const ocrResults: string[] = [];
    
    for (const page of pages) {
      try {
        const tempPath = path.join(path.dirname(filePath), `temp_ocr_${Date.now()}_${page.pageNumber}.png`);
        await fs.promises.writeFile(tempPath, page.content);
        
        const result = await MacOCR.recognizeFromPath(tempPath);
        ocrResults.push(result.text);
        
        await fs.promises.unlink(tempPath).catch(() => {});
      } catch (pageError) {
        console.error(`OCR error on page ${page.pageNumber}:`, pageError);
      }
    }
    
    return ocrResults.join('\n\n');
  } catch (error) {
    console.error('OCR error:', error);
    throw error;
  }
}

