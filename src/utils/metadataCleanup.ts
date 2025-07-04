import fs from 'node:fs';
import path from 'node:path';
import { devLog, errorLog } from './logger';

/**
 * Cleans up stale entries from the metadata file
 * Removes entries for files that no longer exist
 */
export async function cleanupMetadata(watchFolder: string): Promise<number> {
  const metadataPath = path.join(watchFolder, 'file wrangler', '.metadata.json');
  
  try {
    // Check if metadata file exists
    if (!fs.existsSync(metadataPath)) {
      devLog('No metadata file to clean up');
      return 0;
    }
    
    // Read current metadata
    const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    const originalCount = Object.keys(metadata).length;
    let removedCount = 0;
    
    // Check each entry
    for (const [filename, data] of Object.entries(metadata)) {
      const filePath = (data as any).currentPath || (data as any).inboxPath;
      
      if (filePath && !fs.existsSync(filePath)) {
        devLog(`Removing stale metadata for: ${filename}`);
        delete metadata[filename];
        removedCount++;
      }
    }
    
    // Write cleaned metadata back
    if (removedCount > 0) {
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      devLog(`Metadata cleanup complete: removed ${removedCount} stale entries, ${Object.keys(metadata).length} remaining`);
    } else {
      devLog('No stale metadata entries found');
    }
    
    return removedCount;
  } catch (error) {
    errorLog('Failed to cleanup metadata:', error);
    return 0;
  }
}

/**
 * Gets statistics about the metadata file
 */
export async function getMetadataStats(watchFolder: string): Promise<{
  totalEntries: number;
  staleEntries: number;
  validEntries: number;
  byCategory: Record<string, number>;
}> {
  const metadataPath = path.join(watchFolder, 'file wrangler', '.metadata.json');
  
  try {
    if (!fs.existsSync(metadataPath)) {
      return { totalEntries: 0, staleEntries: 0, validEntries: 0, byCategory: {} };
    }
    
    const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    let staleCount = 0;
    let validCount = 0;
    const byCategory: Record<string, number> = {};
    
    for (const [filename, data] of Object.entries(metadata)) {
      const filePath = (data as any).currentPath || (data as any).inboxPath;
      
      if (filePath && fs.existsSync(filePath)) {
        validCount++;
        
        // Extract category from path
        const match = filePath.match(/file wrangler\/([^\/]+)\//);
        if (match) {
          const category = match[1];
          byCategory[category] = (byCategory[category] || 0) + 1;
        }
      } else {
        staleCount++;
      }
    }
    
    return {
      totalEntries: Object.keys(metadata).length,
      staleEntries: staleCount,
      validEntries: validCount,
      byCategory
    };
  } catch (error) {
    errorLog('Failed to get metadata stats:', error);
    return { totalEntries: 0, staleEntries: 0, validEntries: 0, byCategory: {} };
  }
}