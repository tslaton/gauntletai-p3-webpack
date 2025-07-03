import { StateGraph, START, END } from '@langchain/langgraph';
import fs from 'node:fs';
import path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { devLog, errorLog } from '../utils/logger';

// State definition for organization
export interface OrganizationState {
  watchFolder: string;
  fileMetadata: Record<string, any>;
  organizationPlan?: Array<{
    currentPath: string;
    newPath: string;
    reason?: string;
  }>;
  error?: string;
  movedFiles?: number;
}

// Factory function to create organization pipeline
export function createOrganizationPipeline(
  openaiApiKey: string,
  llmModel: string,
  useLowercase = true
) {
  // Create the model instance
  let model: ChatOpenAI | ChatOllama | null = null;
  
  if (llmModel?.startsWith('ollama:')) {
    const ollamaModel = llmModel.substring(7);
    model = new ChatOllama({
      model: ollamaModel,
      temperature: 0,
    });
    devLog('Using Ollama model for organization:', ollamaModel);
  } else if (openaiApiKey) {
    model = new ChatOpenAI({
      apiKey: openaiApiKey,
      model: llmModel || 'gpt-4.1-nano',
      temperature: 0,
    });
    devLog('Using OpenAI model for organization:', llmModel);
  }

  // Node: Read files from inbox
  async function scanInbox(state: OrganizationState): Promise<Partial<OrganizationState>> {
    devLog('Scanning inbox for files to organize');
    
    try {
      const inboxPath = path.join(state.watchFolder, 'file wrangler', 'inbox');
      const metadataPath = path.join(state.watchFolder, 'file wrangler', '.metadata.json');
      
      // Check if inbox exists
      if (!fs.existsSync(inboxPath)) {
        devLog('No inbox directory found');
        return { fileMetadata: {} };
      }
      
      // Read metadata file
      let metadata: Record<string, any> = {};
      try {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        devLog('No metadata file found or error reading it');
      }
      
      // Get all PDF files in inbox
      const files = await fs.promises.readdir(inboxPath);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));
      
      devLog(`Files in inbox: ${pdfFiles.join(', ')}`);
      devLog(`Metadata keys: ${Object.keys(metadata).join(', ')}`);
      
      // Filter metadata to only include files that exist in inbox
      const activeMetadata: Record<string, any> = {};
      
      // For files without metadata, create basic metadata from filename
      for (const file of pdfFiles) {
        if (metadata[file]) {
          activeMetadata[file] = metadata[file];
        } else {
          devLog(`Warning: No metadata found for file: ${file}, creating basic metadata`);
          // Extract basic info from filename pattern: date title [addressee].pdf
          const match = file.match(/^(\d{4}-\d{2}-\d{2})\s+(.+?)\s*(?:\[(.+?)\])?\.pdf$/i);
          if (match) {
            activeMetadata[file] = {
              metadata: {
                date: match[1],
                title: match[2],
                addressee: match[3] || '',
                tags: [],
                categoryHint: 'uncategorized',
                docType: 'unknown'
              },
              inboxPath: path.join(inboxPath, file)
            };
          }
        }
      }
      
      devLog(`Found ${pdfFiles.length} files in inbox, ${Object.keys(activeMetadata).length} with metadata`);
      return { fileMetadata: activeMetadata };
    } catch (error) {
      errorLog('Error scanning inbox:', error);
      return { error: `Failed to scan inbox: ${error}` };
    }
  }

  // Node: Plan organization using LLM
  async function planOrganization(state: OrganizationState): Promise<Partial<OrganizationState>> {
    if (!state.fileMetadata || Object.keys(state.fileMetadata).length === 0) {
      devLog('No files to organize');
      return { organizationPlan: [] };
    }
    
    if (!model) {
      return { error: 'LLM model not configured for organization' };
    }
    
    devLog(`Planning organization for ${Object.keys(state.fileMetadata).length} files`);
    
    try {
      // Prepare file information for LLM
      const fileInfoList = Object.entries(state.fileMetadata).map(([filename, data]) => ({
        filename,
        title: data.metadata?.title || 'Unknown',
        tags: data.metadata?.tags || [],
        categoryHint: data.metadata?.categoryHint || 'uncategorized',
        docType: data.metadata?.docType || 'unknown',
        date: data.metadata?.date || null,
        addressee: data.metadata?.addressee || ''
      }));
      
      const systemPrompt = `You are an intelligent file organization assistant. Your task is to organize PDF files into a logical folder structure.

Guidelines:
1. Create a SINGLE-LEVEL folder structure (NO subcategories)
2. Use 8-15 main categories that cover all document types
3. Use clear, intuitive folder names that an average person would understand
4. Each document goes into exactly ONE folder
5. Suggested categories:
   - financial (bank statements, tax documents, investments)
   - medical (health records, test results, prescriptions)
   - insurance (all insurance policies and claims)
   - property (real estate, home documents)
   - utilities (electric, gas, water, internet, phone bills)
   - receipts (purchase receipts, invoices)
   - legal (contracts, notices, legal documents)
   - travel (bookings, itineraries, rental agreements)
   - work (employment documents, pay stubs)
   - personal (certificates, licenses, other personal docs)
6. Consider the categoryHint and tags when organizing
7. When in doubt, choose the most specific applicable category

CRITICAL: You MUST use the EXACT filename provided in the input. Do not modify, shorten, or change the filename in any way.

For each file, output a JSON object with:
- currentPath: "inbox/{EXACT filename as provided}"
- newPath: "{category}/{EXACT filename as provided}"
- reason: brief explanation (max 10 words)

NO SUBCATEGORIES. Just category/filename.

Return a JSON array of all file movements.`;

      const userPrompt = `Please organize these files:\n\n${JSON.stringify(fileInfoList, null, 2)}`;
      
      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);
      
      const content = response.content.toString();
      const organizationPlan = JSON.parse(content);
      
      // Validate and prefix paths correctly
      const validatedPlan = organizationPlan.map((item: any) => ({
        currentPath: path.join(state.watchFolder, 'file wrangler', item.currentPath),
        newPath: path.join(state.watchFolder, 'file wrangler', useLowercase ? item.newPath.toLowerCase() : item.newPath),
        reason: item.reason
      }));
      
      devLog(`Organization plan created with ${validatedPlan.length} file movements`);
      return { organizationPlan: validatedPlan };
    } catch (error) {
      errorLog('Organization planning error:', error);
      return { error: `Failed to plan organization: ${error}` };
    }
  }

  // Node: Execute the organization plan
  async function executeOrganization(state: OrganizationState): Promise<Partial<OrganizationState>> {
    if (!state.organizationPlan || state.organizationPlan.length === 0) {
      devLog('No organization plan to execute');
      return { movedFiles: 0 };
    }
    
    devLog(`Executing organization plan for ${state.organizationPlan.length} files`);
    
    let movedCount = 0;
    const errors: string[] = [];
    
    for (const move of state.organizationPlan) {
      try {
        // Check if source file exists
        if (!fs.existsSync(move.currentPath)) {
          const errorMsg = `Source file not found: ${path.basename(move.currentPath)}`;
          errorLog(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // Create target directory if it doesn't exist
        const targetDir = path.dirname(move.newPath);
        await fs.promises.mkdir(targetDir, { recursive: true });
        
        // Move the file
        await fs.promises.rename(move.currentPath, move.newPath);
        movedCount++;
        
        devLog(`Moved: ${path.basename(move.currentPath)} → ${move.newPath.replace(state.watchFolder, '...')}`);
      } catch (error) {
        const errorMsg = `Failed to move ${path.basename(move.currentPath)}: ${error}`;
        errorLog(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // Update metadata file to reflect new locations
    try {
      const metadataPath = path.join(state.watchFolder, 'file wrangler', '.metadata.json');
      const metadata = state.fileMetadata;
      
      // Update paths in metadata
      for (const move of state.organizationPlan) {
        const filename = path.basename(move.currentPath);
        if (metadata[filename]) {
          metadata[filename].currentPath = move.newPath;
          metadata[filename].lastOrganized = new Date().toISOString();
        }
      }
      
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      errorLog('Failed to update metadata after organization:', error);
    }
    
    devLog(`Organization complete: ${movedCount}/${state.organizationPlan.length} files moved`);
    
    if (errors.length > 0) {
      return { 
        movedFiles: movedCount, 
        error: `Completed with errors: ${errors.join('; ')}` 
      };
    }
    
    return { movedFiles: movedCount };
  }

  // Create the graph
  const workflow = new StateGraph<OrganizationState, Partial<OrganizationState>>({
    channels: {
      watchFolder: null,
      fileMetadata: null,
      organizationPlan: null,
      error: null,
      movedFiles: null,
    }
  });
  
  // Add nodes
  workflow.addNode('scan', scanInbox as any);
  workflow.addNode('plan', planOrganization as any);
  workflow.addNode('execute', executeOrganization as any);
  
  // Add edges
  workflow.addEdge(START, 'scan' as any);
  workflow.addEdge('scan' as any, 'plan' as any);
  workflow.addEdge('plan' as any, 'execute' as any);
  workflow.addEdge('execute' as any, END);
  
  // Compile and return
  return workflow.compile();
}