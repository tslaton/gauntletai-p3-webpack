import { devLog, errorLog } from './logger';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    devLog('Fetched Ollama models:', data.models?.length || 0);
    return data.models || [];
  } catch (error) {
    errorLog('Error fetching Ollama models:', error);
    return [];
  }
}

export function isOllamaRunning(): Promise<boolean> {
  return fetch('http://localhost:11434/api/tags')
    .then(response => response.ok)
    .catch(() => false);
}