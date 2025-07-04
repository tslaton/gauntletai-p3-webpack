import fs from 'node:fs';
import path from 'node:path';
import { devLog, errorLog } from './logger';

// File lock to prevent concurrent writes
let isWriting = false;
const writeQueue: Array<() => Promise<void>> = [];

/**
 * Safely read metadata file
 */
export async function readMetadata(metadataPath: string): Promise<Record<string, any>> {
  try {
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Safely write metadata file with queue to prevent concurrent writes
 */
async function writeMetadata(metadataPath: string, metadata: Record<string, any>): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(metadataPath);
  await fs.promises.mkdir(dir, { recursive: true });
  
  // Write with atomic operation (write to temp file then rename)
  const tempPath = `${metadataPath}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(metadata, null, 2));
  await fs.promises.rename(tempPath, metadataPath);
}

/**
 * Process write queue
 */
async function processWriteQueue(): Promise<void> {
  if (isWriting || writeQueue.length === 0) {
    return;
  }
  
  isWriting = true;
  
  while (writeQueue.length > 0) {
    const writeOperation = writeQueue.shift();
    if (writeOperation) {
      try {
        await writeOperation();
      } catch (error) {
        errorLog('Error processing write queue:', error);
      }
    }
  }
  
  isWriting = false;
}

/**
 * Update metadata for a specific file
 */
export async function updateFileMetadata(
  metadataPath: string,
  filename: string,
  updates: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        const metadata = await readMetadata(metadataPath);
        
        if (updates === null) {
          // Delete the entry
          delete metadata[filename];
          devLog(`Deleted metadata for ${filename}`);
        } else {
          // Update or create the entry
          metadata[filename] = updates;
          devLog(`Updated metadata for ${filename}`);
        }
        
        await writeMetadata(metadataPath, metadata);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    processWriteQueue();
  });
}

/**
 * Update multiple metadata entries at once
 */
export async function updateBulkMetadata(
  metadataPath: string,
  updates: Record<string, any>
): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        const metadata = await readMetadata(metadataPath);
        
        // Apply all updates
        for (const [filename, data] of Object.entries(updates)) {
          if (data === null) {
            delete metadata[filename];
          } else {
            // Replace the entire entry (caller should merge if needed)
            metadata[filename] = data;
          }
        }
        
        await writeMetadata(metadataPath, metadata);
        devLog(`Updated metadata for ${Object.keys(updates).length} files`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    processWriteQueue();
  });
}

/**
 * Remove metadata entries for files that no longer exist
 */
export async function cleanupStaleMetadata(metadataPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        const metadata = await readMetadata(metadataPath);
        const staleEntries: string[] = [];
        
        for (const [filename, data] of Object.entries(metadata)) {
          const filePath = (data as any).currentPath || (data as any).inboxPath;
          if (filePath && !fs.existsSync(filePath)) {
            staleEntries.push(filename);
            delete metadata[filename];
          }
        }
        
        if (staleEntries.length > 0) {
          await writeMetadata(metadataPath, metadata);
          devLog(`Removed ${staleEntries.length} stale metadata entries`);
        }
        
        resolve(staleEntries.length);
      } catch (error) {
        reject(error);
      }
    });
    
    processWriteQueue();
  });
}

/**
 * Replace entire metadata file (use with caution)
 */
export async function replaceMetadata(
  metadataPath: string,
  newMetadata: Record<string, any>
): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        await writeMetadata(metadataPath, newMetadata);
        devLog(`Replaced entire metadata file with ${Object.keys(newMetadata).length} entries`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    processWriteQueue();
  });
}