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

// Helper function to recursively clean up empty directories
export async function cleanupEmptyDirectories(dirPath: string, isRoot = true): Promise<string[]> {
  const deletedDirs: string[] = [];
  
  try {
    // Don't delete the root file wrangler directory or special directories
    const protectedDirs = ['file wrangler', 'inbox', '.metadata.json'];
    const dirName = path.basename(dirPath);
    
    if (isRoot || protectedDirs.includes(dirName)) {
      // For root and protected dirs, just check subdirectories
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const deleted = await cleanupEmptyDirectories(subDirPath, false);
          deletedDirs.push(...deleted);
        }
      }
    } else {
      // For non-protected directories, check if empty and delete if so
      const entries = await fs.promises.readdir(dirPath);
      
      // Filter out .DS_Store and other system files
      const meaningfulEntries = entries.filter(entry => 
        !entry.startsWith('.') || entry === '.metadata.json'
      );
      
      devLog(`Checking directory: ${dirPath}, entries: ${entries.length}, meaningful: ${meaningfulEntries.length}`);
      
      if (meaningfulEntries.length === 0) {
        // First remove any system files like .DS_Store
        for (const entry of entries) {
          if (entry.startsWith('.') && entry !== '.metadata.json') {
            try {
              await fs.promises.unlink(path.join(dirPath, entry));
              devLog(`Removed system file: ${entry} from ${dirPath}`);
            } catch (err) {
              // Ignore errors removing system files
            }
          }
        }
        
        // Now try to remove the directory
        await fs.promises.rmdir(dirPath);
        deletedDirs.push(path.basename(dirPath));
        devLog(`Deleted empty directory: ${dirPath}`);
      } else {
        // Check subdirectories
        const dirEntries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of dirEntries) {
          if (entry.isDirectory()) {
            const subDirPath = path.join(dirPath, entry.name);
            const deleted = await cleanupEmptyDirectories(subDirPath, false);
            deletedDirs.push(...deleted);
          }
        }
        
        // Check again after subdirectory cleanup
        const entriesAfter = await fs.promises.readdir(dirPath);
        const meaningfulEntriesAfter = entriesAfter.filter(entry => 
          !entry.startsWith('.') || entry === '.metadata.json'
        );
        
        if (meaningfulEntriesAfter.length === 0 && !isRoot) {
          // First remove any system files like .DS_Store
          for (const entry of entriesAfter) {
            if (entry.startsWith('.') && entry !== '.metadata.json') {
              try {
                await fs.promises.unlink(path.join(dirPath, entry));
                devLog(`Removed system file: ${entry} from ${dirPath}`);
              } catch (err) {
                // Ignore errors removing system files
              }
            }
          }
          
          // Now try to remove the directory
          await fs.promises.rmdir(dirPath);
          deletedDirs.push(path.basename(dirPath));
          devLog(`Deleted empty directory after cleanup: ${dirPath}`);
        }
      }
    }
  } catch (error) {
    // Ignore errors for individual directories
    if ((error as any).code !== 'ENOENT') {
      devLog(`Error checking directory ${dirPath}:`, error);
    }
  }
  
  return deletedDirs;
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

  // Node: Read all files for reorganization
  async function scanAllFiles(state: OrganizationState): Promise<Partial<OrganizationState>> {
    devLog('Scanning all files in file wrangler for reorganization');
    
    try {
      const fileWranglerPath = path.join(state.watchFolder, 'file wrangler');
      const metadataPath = path.join(fileWranglerPath, '.metadata.json');
      
      // Read metadata file
      let metadata: Record<string, any> = {};
      try {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        devLog('No metadata file found or error reading it');
      }
      
      // Recursively find all PDF files in file wrangler (except in inbox)
      const allPdfFiles: Array<{filename: string, currentPath: string}> = [];
      
      async function findPdfs(dir: string, baseDir: string = fileWranglerPath) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && entry.name !== 'inbox' && !entry.name.startsWith('.')) {
            await findPdfs(fullPath, baseDir);
          } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
            allPdfFiles.push({
              filename: entry.name,
              currentPath: fullPath
            });
          }
        }
      }
      
      await findPdfs(fileWranglerPath);
      
      devLog(`Found ${allPdfFiles.length} PDF files to reorganize`);
      
      // Build metadata for all files
      const activeMetadata: Record<string, any> = {};
      
      for (const file of allPdfFiles) {
        if (metadata[file.filename]) {
          activeMetadata[file.filename] = {
            ...metadata[file.filename],
            currentPath: file.currentPath
          };
        } else {
          // Extract basic info from filename for files without metadata
          const match = file.filename.match(/^(\d{4}-\d{2}-\d{2})\s+(.+?)\s*(?:\[(.+?)\])?\.pdf$/i);
          if (match) {
            activeMetadata[file.filename] = {
              metadata: {
                date: match[1],
                title: match[2],
                addressee: match[3] || '',
                tags: [],
                categoryHint: 'uncategorized',
                docType: 'unknown'
              },
              currentPath: file.currentPath
            };
          }
        }
      }
      
      devLog(`Prepared metadata for ${Object.keys(activeMetadata).length} files`);
      return { fileMetadata: activeMetadata };
    } catch (error) {
      errorLog('Error scanning all files:', error);
      return { error: `Failed to scan files: ${error}` };
    }
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
      const fileWranglerPath = path.join(state.watchFolder, 'file wrangler');
      const fileInfoList = Object.entries(state.fileMetadata).map(([filename, data]) => {
        // Get relative path from file wrangler directory
        const currentPath = data.currentPath || data.inboxPath || path.join(fileWranglerPath, 'inbox', filename);
        const relativePath = path.relative(fileWranglerPath, currentPath);
        
        return {
          filename,
          currentPath: relativePath,
          title: data.metadata?.title || 'Unknown',
          tags: data.metadata?.tags || [],
          categoryHint: data.metadata?.categoryHint || 'uncategorized',
          docType: data.metadata?.docType || 'unknown',
          date: data.metadata?.date || null,
          addressee: data.metadata?.addressee || ''
        };
      });
      
      // Different prompts for inbox organization vs full reorganization
      const isReorganization = Object.values(state.fileMetadata).some(
        (data: any) => data.currentPath && !data.currentPath.includes('/inbox/')
      );
      
      const systemPrompt = isReorganization ? 
        `You are an intelligent file organization assistant. Your task is to REORGANIZE all PDF files into an optimal folder structure.

This is a FULL REORGANIZATION - you are looking at ALL files to create the best possible organization.

Guidelines:
1. Create a SINGLE-LEVEL folder structure (NO subcategories)
2. Analyze ALL files holistically to determine the best categories
3. Create 10-15 categories that best fit the actual documents you see
4. Some files may need to move to different categories for better organization
5. Standard categories to consider:
   - services (electric, gas, water, internet, phone bills, etc.)
   - insurance (all insurance policies and claims, etc.)
   - medical (health records, test results, prescriptions, etc.)
   - property (real estate, home documents, mortgage statements, closing documents,etc.)
   - receipts (purchase receipts, invoices, shipping labels, etc.)
   - travel (bookings, itineraries, rental agreements, etc.)
   - work (employment documents, pay stubs, etc.)
   - legal (contracts, notices, legal documents, jury summons, government-related stuff, etc.)
   - personal (licenses, IDs, etc.)
   - financial (ONLY for bank statements, investment documents, tax documents, etc.)
   - other (anything that doesn't fit into the other categories)
6. IMPORTANT: "financial" is a LOW PRIORITY category. Only use it if no higher priority category fits.
7. Consider the title, categoryHint, and tags when reorganizing
8. You may create new categories if they better fit the documents
9. Consider document relationships - related documents should be in the same category

CRITICAL: You MUST use the EXACT filename provided. Preserve it exactly.

For each file, output a JSON object with:
- currentPath: "{current location relative to file wrangler}/{EXACT filename}"
- newPath: "{category}/{EXACT filename}"
- reason: brief explanation

Return a JSON array for ALL files, even if some don't need to move.`
        :
        `You are an intelligent file organization assistant. Your task is to organize PDF files into a logical folder structure.

Guidelines:
1. Create a SINGLE-LEVEL folder structure (NO subcategories)
2. Use 10-15 main categories that cover all document types
3. Use clear, intuitive folder names that an average person would understand
4. Each document goes into exactly ONE folder
5. Suggested categories (in order of priority):
   - services (electric, gas, water, internet, phone bills, etc.)
   - insurance (all insurance policies and claims, etc.)
   - medical (health records, test results, prescriptions, etc.)
   - property (real estate, home documents, mortgage statements, closing documents,etc.)
   - receipts (purchase receipts, invoices, shipping labels, etc.)
   - travel (bookings, itineraries, rental agreements, etc.)
   - work (employment documents, pay stubs, etc.)
   - legal (contracts, notices, legal documents, jury summons, government-related stuff, etc.)
   - personal (licenses, IDs, etc.)
   - financial (ONLY for bank statements, investment documents, tax documents, etc.)
   - other (anything that doesn't fit into the other categories)
6. IMPORTANT: "financial" is a LOW PRIORITY category. Only use it if no higher priority category fits.
7. Consider the title, categoryHint, and tags when organizing

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
    let movedCount = 0;
    const errors: string[] = [];
    
    // Execute the organization plan if there is one
    if (state.organizationPlan && state.organizationPlan.length > 0) {
      devLog(`Executing organization plan for ${state.organizationPlan.length} files`);
      
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
    } else {
      devLog('No files to organize in this run');
    }
    
    // Note: The file wrangler watcher will detect the moves and update metadata
    // We should NOT run stale cleanup or directory cleanup here because:
    // 1. Files are being moved, not deleted
    // 2. The watcher will handle metadata updates as it detects file movements
    // 3. The watcher will also schedule directory cleanup if needed
    
    // Log the completion message
    if (state.organizationPlan && state.organizationPlan.length > 0) {
      devLog(`Organization complete: ${movedCount}/${state.organizationPlan.length} files moved`);
    } else {
      devLog('Metadata and directory cleanup completed');
    }
    
    if (errors.length > 0) {
      return { 
        movedFiles: movedCount, 
        error: `Completed with errors: ${errors.join('; ')}` 
      };
    }
    
    return { movedFiles: movedCount };
  }

  // Create the graph for normal organization (inbox only)
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
  
  // Create separate workflow for full reorganization
  const reorganizeWorkflow = new StateGraph<OrganizationState, Partial<OrganizationState>>({
    channels: {
      watchFolder: null,
      fileMetadata: null,
      organizationPlan: null,
      error: null,
      movedFiles: null,
    }
  });
  
  // Add nodes for reorganization
  reorganizeWorkflow.addNode('scanAll', scanAllFiles as any);
  reorganizeWorkflow.addNode('plan', planOrganization as any);
  reorganizeWorkflow.addNode('execute', executeOrganization as any);
  
  // Add edges
  reorganizeWorkflow.addEdge(START, 'scanAll' as any);
  reorganizeWorkflow.addEdge('scanAll' as any, 'plan' as any);
  reorganizeWorkflow.addEdge('plan' as any, 'execute' as any);
  reorganizeWorkflow.addEdge('execute' as any, END);
  
  // Compile both workflows
  const compiledWorkflow = workflow.compile();
  const compiledReorganizeWorkflow = reorganizeWorkflow.compile();
  
  // Return an object with both workflows
  return {
    organization: compiledWorkflow,
    reorganization: compiledReorganizeWorkflow
  };
}