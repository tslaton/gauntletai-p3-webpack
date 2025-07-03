import { StateGraph, START, END } from '@langchain/langgraph';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import PDFParser from 'pdf2json';
import MacOCR from '@cherrystudio/mac-system-ocr';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { devLog, errorLog } from '../utils/logger';

// State definition
export interface PDFState {
  path: string;
  rawText?: string;
  meta?: {
    date: string;
    title: string;
    addressee: string;
    tags?: string[];
    categoryHint?: string;
    docType?: string;
  };
  error?: string;
  newPath?: string;
}

// Factory function to create pipeline with current configuration
export function createPDFPipeline(
  openaiApiKey: string, 
  llmModel: string, 
  useLowercase = true,
  processingMode = 'accuracy'
) {
  // Create the model instance once for this pipeline
  let model: ChatOpenAI | ChatOllama | null = null;
  
  // Check if it's an Ollama model
  if (llmModel?.startsWith('ollama:')) {
    const ollamaModel = llmModel.substring(7); // Remove 'ollama:' prefix
    model = new ChatOllama({
      model: ollamaModel,
      temperature: 0,
    });
  } else if (openaiApiKey) {
    model = new ChatOpenAI({
      modelName: llmModel || 'gpt-4.1-nano',
      temperature: 0,
      openAIApiKey: openaiApiKey,
    });
  }

  // OCR function with access to processingMode
  async function ocrPDF(filePath: string): Promise<string> {
    // Check if running on macOS
    if (process.platform !== 'darwin') {
      throw new Error('OCR functionality is only available on macOS. Please ensure PDF files contain extractable text.');
    }
    
    let sessionDir: string | null = null;
    
    try {
      devLog('Starting OCR process for:', filePath);
      
      // Import pdf2img-electron in main process
      const pdf2img = require('pdf2img-electron');
      
      // Generate unique identifier for this PDF processing session
      const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create unique temp directory for this session
      sessionDir = path.join(os.tmpdir(), `pdf-ocr-${sessionId}`);
      await fs.promises.mkdir(sessionDir, { recursive: true });
      devLog(`Created session directory: ${sessionDir}`);
      
      const pdfData = pdf2img.default(filePath);
      devLog(`PDF loaded: ${pdfData.pages} pages`);
      
      // First, let's check the actual page count with pdf2json for comparison
      let actualPageCount = pdfData.pages;
      try {
        const pdfParser = new PDFParser();
        const pdfInfo = await new Promise<number>((resolve) => {
          pdfParser.on('pdfParser_dataReady', (data: any) => {
            resolve(data.Pages ? data.Pages.length : 1);
          });
          pdfParser.on('pdfParser_dataError', () => resolve(pdfData.pages));
          pdfParser.loadPDF(filePath);
        });
        
        if (pdfInfo > pdfData.pages) {
          errorLog(`CRITICAL: pdf2img sees ${pdfData.pages} pages but pdf2json sees ${pdfInfo} pages!`);
          actualPageCount = pdfInfo;
        }
      } catch (e) {
        devLog('Could not verify page count with pdf2json');
      }
      
      // Convert to PNG buffers
      // Note: You may see "tile memory limits exceeded" warnings from Chromium at scale 3.0
      // These are harmless for our use case - they just mean Chromium's internal tile buffer
      // is conservative. The full image is still rendered correctly for OCR.
      const scale = 1.0; // 1.0 might also be more accurate than 2.0 or 3.0 but we can change based on processingMode
      devLog(`Using scale ${scale} for ${processingMode} mode`);
      
      let imageBuffers: Buffer[] = [];
      try {
        imageBuffers = await pdfData.toPNG({ scale, logging: true });
        devLog(`Got ${imageBuffers.length} images from PDF`);
        
        // If we're missing pages, pdf2img might not be loading the PDF correctly
        // Since pdf2img thinks there's only 1 page, we need a workaround
        if (imageBuffers.length < actualPageCount && actualPageCount > 1) {
          errorLog(`Missing pages! pdf2img only loaded ${pdfData.pages} of ${actualPageCount} pages.`);
          errorLog(`This is a known issue with pdf2img-electron and certain PDF types.`);
          
          // Unfortunately, we can only process what pdf2img can see
          // Log this for the user to know
          devLog(`Note: This PDF contains ${actualPageCount} pages, but only ${imageBuffers.length} could be processed due to pdf2img-electron limitations`);
        }
        
        // Log buffer sizes to detect potential issues
        imageBuffers.forEach((buffer, index) => {
          devLog(`Page ${index + 1} image size: ${buffer.length} bytes`);
        });
      } catch (conversionError) {
        errorLog('Error converting PDF to images:', conversionError);
        throw new Error(`Failed to convert PDF to images: ${conversionError}`);
      }
      
      // Use macOS OCR on each image
      const ocrTexts: string[] = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        devLog(`Processing page ${i + 1} of ${imageBuffers.length}`);
        
        // Check if buffer is valid
        if (!imageBuffers[i] || imageBuffers[i].length === 0) {
          errorLog(`WARNING: Page ${i + 1} has empty or invalid image buffer`);
          ocrTexts.push(`[Page ${i + 1} could not be converted to image]`);
          continue;
        }
        
        // Save image to temporary file for OCR in session directory
        const tempPath = path.join(sessionDir!, `page${i + 1}.png`);
        
        try {
          await fs.promises.writeFile(tempPath, imageBuffers[i]);
        } catch (writeError) {
          errorLog(`Failed to write page ${i + 1} to temp file:`, writeError);
          ocrTexts.push(`[Error saving page ${i + 1}]`);
          continue;
        }
        
        try {
          // OCR the image with accurate recognition mode
          const result = await MacOCR.recognizeFromPath(tempPath, {
            recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
            languages: 'en-US',
            minConfidence: 0.0  // Accept all text, let LLM filter
          });
          
          if (result && typeof result === 'string') {
            ocrTexts.push(result);
          } else if (result && typeof result === 'object' && 'text' in result) {
            ocrTexts.push((result as any).text);
          } else {
            devLog(`Warning: No text extracted from page ${i + 1}`);
          }
        } catch (pageError) {
          errorLog(`Failed to OCR page ${i + 1}:`, pageError);
          // Continue with other pages instead of failing completely
          ocrTexts.push(`[Error processing page ${i + 1}]`);
        }
      }
      
      // Join all text from all pages
      let fullText = ocrTexts.join('\n\n');
      
      // Verify we processed all pages
      if (ocrTexts.length !== imageBuffers.length) {
        errorLog(`Warning: Page count mismatch! Expected ${imageBuffers.length} pages, processed ${ocrTexts.length}`);
      }
      
      // Add note about missing pages if applicable
      if (imageBuffers.length < actualPageCount && actualPageCount > 1) {
        fullText += `\n\n[NOTE: This PDF contains ${actualPageCount} pages, but only ${imageBuffers.length} could be processed due to pdf2img-electron limitations with mixed-orientation PDFs.]`;
      }
      
      devLog(`OCR completed: ${ocrTexts.length}/${imageBuffers.length} pages, ${fullText.length} characters`);
      
      // Clean up session directory
      if (sessionDir) {
        try {
          await fs.promises.rm(sessionDir, { recursive: true, force: true });
          devLog(`Cleaned up session directory: ${sessionDir}`);
        } catch (cleanupError) {
          devLog(`Warning: Failed to clean up session directory ${sessionDir}:`, cleanupError);
        }
      }
      
      return fullText;
    } catch (error) {
      errorLog('OCR error:', error);
      
      // Clean up session directory on error
      if (sessionDir) {
        try {
          await fs.promises.rm(sessionDir, { recursive: true, force: true });
        } catch (cleanupError) {
          devLog(`Warning: Failed to clean up session directory on error:`, cleanupError);
        }
      }
      
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Graph nodes with configuration closure
  async function parsePDF(state: PDFState): Promise<Partial<PDFState>> {
    devLog('Parsing PDF:', state.path);
    
    try {
      // First try with pdf2json
      const text = await extractTextWithPDF2JSON(state.path);
      
      // Check if we got meaningful text
      const cleanText = text.trim();
      const hasMultiplePages = cleanText.includes('[Page 2]');
      
      // If text is too short or we detected multiple pages with no text, use OCR
      if (cleanText.length < 20 || (hasMultiplePages && cleanText.length < 100)) {
        devLog(`Text extraction insufficient (length: ${cleanText.length}, multiple pages: ${hasMultiplePages}), using OCR fallback`);
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
      devLog('LLM: Model not configured');
      return { error: 'LLM model not configured' };
    }
    
    devLog('Extracting metadata with LLM, text length:', state.rawText.length);
    
    try {
      const systemPrompt = `You are a parser that extracts metadata from documents.

Extract the following fields:
1. date (yyyy-mm-dd; null if absent)
2. title (<= 8 words, no commas; if the title is not descriptive of the document, write the name of the bank, business, or other entity sending the document and describe the document's main subject in a few words instead)
3. addressees (<= 2 first names only, left blank if unknown; prefer proper names to generic terms like "customer")
4. tags (3-5 descriptive tags that capture the document's nature, purpose, and content)
5. categoryHint (suggested category folder like "financial", "medical", "insurance", "property", "services", "receipts", etc.)
6. docType (specific document type like "bank-statement", "invoice", "contract", "policy", "receipt", etc.)

Prefer as addressees the names "Trevor", "Maryam", "Ghufran", and "Saira" if they are present in the document.

Return JSON exactly like:
{"date":"...", "title":"...", "addressees":"...", "tags":["..."], "categoryHint":"...", "docType":"..."}

Here are some examples:

{"date":"2025-01-01","title":"Wells Fargo Bank Statement","addressees":"Trevor","tags":["banking","financial","statement","wells-fargo","monthly"],"categoryHint":"financial","docType":"bank-statement"}
{"date":"2017-06-03","title":"Chicago Title Company Closing Disclosure","addressees":"Maryam Trevor","tags":["real-estate","closing","property","title","mortgage"],"categoryHint":"property","docType":"closing-disclosure"}
{"date":"2023-10-15","title":"PG&E Electric Bill and Statement","addressees":"Ghufran","tags":["utility","electricity","pge","bill","monthly"],"categoryHint":"services","docType":"utility-bill"}
{"date":"2024-11-07","title":"GEICO Insurance Policy","addressees":"Saira","tags":["insurance","auto","geico","policy","coverage"],"categoryHint":"insurance","docType":"insurance-policy"}
{"date":null,"title":"Uplift Desk UPS Shipping Label","addressees":"Trevor","tags":["shipping","ups","delivery","furniture","tracking"],"categoryHint":"receipts","docType":"shipping-label"}
{"date":null,"title":"Ameritas Disability Insurance Notice","addressees":"","tags":["insurance","disability","ameritas","notice","benefits"],"categoryHint":"insurance","docType":"insurance-notice"}
`;
      
      const userPrompt = `Document text follows \`\`\`
${state.rawText.slice(0, 12000)}
\`\`\``;
      
      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);
      
      const content = response.content.toString();
      const metadata = JSON.parse(content);
      
      // Handle null date properly - use today's date if null, "null", or empty
      const today = new Date().toISOString().split('T')[0];
      const extractedDate = metadata.date;
      const finalDate = (extractedDate && extractedDate !== 'null' && extractedDate !== '') 
        ? extractedDate 
        : today;
      
      return {
        meta: {
          date: finalDate,
          title: (metadata.title || 'Untitled').slice(0, 100),
          addressee: (metadata.addressees || metadata.addressee || 'Unknown').slice(0, 50),
          tags: metadata.tags || [],
          categoryHint: metadata.categoryHint || 'uncategorized',
          docType: metadata.docType || 'unknown'
        }
      };
    } catch (error) {
      errorLog('LLM error:', error);
      return { error: `Failed to extract metadata: ${error}` };
    }
  }

  // Helper function to save metadata with retry logic
  async function saveMetadataWithRetry(
    metadataPath: string, 
    filename: string, 
    data: any, 
    maxRetries = 3
  ): Promise<void> {
    let retries = maxRetries;
    while (retries > 0) {
      try {
        let existingMetadata: Record<string, any> = {};
        
        try {
          const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
          existingMetadata = JSON.parse(metadataContent);
        } catch (error) {
          // File doesn't exist yet, that's ok
        }
        
        // Add or update metadata for this file
        existingMetadata[filename] = data;
        
        await fs.promises.writeFile(metadataPath, JSON.stringify(existingMetadata, null, 2));
        return; // Success, exit function
      } catch (error) {
        retries--;
        if (retries === 0) {
          errorLog('Failed to write metadata after retries:', error);
          throw error;
        } else {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  async function renameFile(state: PDFState): Promise<Partial<PDFState>> {
    if (!state.meta) {
      return { error: 'No metadata for renaming' };
    }
    
    devLog('Renaming file with metadata:', state.meta);
    
    try {
      const originalDir = path.dirname(state.path);
      
      // Create the 'file wrangler/inbox' directory if it doesn't exist
      const fileWranglerDir = path.join(originalDir, 'file wrangler', 'inbox');
      await fs.promises.mkdir(fileWranglerDir, { recursive: true });
      
      // Process addressees: split by space, take first 2, remove duplicates
      const addresseesList = state.meta.addressee.split(/\s+/)
        .filter(name => name.length > 0)
        .slice(0, 2);
      
      // Remove duplicates while preserving order
      const uniqueAddressees = [...new Set(addresseesList)];
      
      // Format each addressee in its own brackets
      const addresseesString = uniqueAddressees.map(name => `[${name}]`).join('');
      
      const newName = `${state.meta.date} ${state.meta.title} ${addresseesString}.pdf`;
      
      // Clean filename for filesystem
      let cleanName = newName.replace(/[<>:"/\\|?*]/g, '-');
      
      // Apply lowercase if configured
      if (useLowercase) {
        cleanName = cleanName.toLowerCase();
      }
      
      // The new path is in the 'file wrangler/inbox' directory
      const newPath = path.join(fileWranglerDir, cleanName);
      
      // Check if file already exists
      if (fs.existsSync(newPath) && newPath !== state.path) {
        let counter = 1;
        let finalPath = newPath;
        while (fs.existsSync(finalPath)) {
          const base = path.basename(newPath, '.pdf');
          finalPath = path.join(fileWranglerDir, `${base} (${counter}).pdf`);
          counter++;
        }
        await fs.promises.rename(state.path, finalPath);
        
        // Save metadata with the final filename
        const metadataPath = path.join(originalDir, 'file wrangler', '.metadata.json');
        const finalName = path.basename(finalPath);
        
        await saveMetadataWithRetry(metadataPath, finalName, {
          originalPath: state.path,
          processedAt: new Date().toISOString(),
          metadata: state.meta,
          inboxPath: finalPath
        });
        
        return { newPath: finalPath };
      }
      
      await fs.promises.rename(state.path, newPath);
      
      // Save metadata to a JSON file for the organization agent
      const metadataPath = path.join(originalDir, 'file wrangler', '.metadata.json');
      
      await saveMetadataWithRetry(metadataPath, cleanName, {
        originalPath: state.path,
        processedAt: new Date().toISOString(),
        metadata: state.meta,
        inboxPath: newPath
      });
      
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
        devLog(`pdf2json detected ${pdfData.Pages.length} pages in PDF`);
        
        for (let i = 0; i < pdfData.Pages.length; i++) {
          const page = pdfData.Pages[i];
          if (page.Texts) {
            let pageText = '';
            for (const textItem of page.Texts) {
              if (textItem.R) {
                for (const r of textItem.R) {
                  if (r.T) {
                    pageText += decodeURIComponent(r.T) + ' ';
                  }
                }
              }
            }
            if (pageText.trim()) {
              text += `[Page ${i + 1}]\n${pageText}\n\n`;
            }
          }
        }
      }
      
      resolve(text);
    });
    
    pdfParser.loadPDF(filePath);
  });
}


