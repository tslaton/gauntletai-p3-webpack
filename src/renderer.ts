import './index.css';
import { devLog, errorLog } from './utils/logger';
import iconPath from './assets/icon.png';

// Declare the electron API interface
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<boolean>;
      selectFolder: () => Promise<string | null>;
      showNotification: (title: string, body: string) => Promise<void>;
      openFolder: () => Promise<void>;
      getOllamaModels: () => Promise<any[]>;
      processPDF: (filePath: string) => Promise<void>;
      organizeFiles: () => Promise<{success: boolean, movedFiles?: number, error?: string}>;
      reorganizeAllFiles: () => Promise<{success: boolean, movedFiles?: number, error?: string}>;
      getInboxCount: () => Promise<number>;
      onPDFAdded: (callback: (filePath: string) => void) => void;
      onProcessingUpdate: (callback: (data: any) => void) => void;
      onDebugLog: (callback: (message: string) => void) => void;
      onOrganizationStatus: (callback: (data: any) => void) => void;
      sendDebugMessage: (message: string) => void;
    };
  }
}

interface ActivityItem {
  id: string;
  filename: string;
  newFilename?: string;
  status: 'parsing' | 'extracting' | 'renaming' | 'completed' | 'error';
  message: string;
  timestamp: Date;
}

class PDFRenamerApp {
  private activities: ActivityItem[] = [];
  private config: any = {};
  
  constructor() {
    this.initializeApp();
    this.setupEventListeners();
    this.setupIPCListeners();
  }
  
  private async initializeApp() {
    try {
      // Load configuration
      this.config = await window.electronAPI.getConfig();
      // Load Ollama models if an Ollama model is selected
      if (this.config.llmModel?.startsWith('ollama:')) {
        await this.loadOllamaModels();
      }
      this.updateUI();
    } catch (error) {
      errorLog('Failed to initialize app:', error);
    }
  }
  
  private updateUI() {
    // Update folder path display
    const folderPathEl = document.getElementById('folder-path');
    if (folderPathEl) {
      folderPathEl.textContent = this.config.watchFolder || 'Not configured';
    }
    
    // Update inbox count
    this.updateInboxCount();
    
    // Update settings modal
    const watchFolderInput = document.getElementById('watch-folder-input') as HTMLInputElement;
    const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
    const processingModeSelect = document.getElementById('processing-mode-select') as HTMLSelectElement;
    const lowercaseCheckbox = document.getElementById('lowercase-checkbox') as HTMLInputElement;
    const autoOrganizeCheckbox = document.getElementById('auto-organize-checkbox') as HTMLInputElement;
    const autoOrganizeThreshold = document.getElementById('auto-organize-threshold') as HTMLInputElement;
    
    if (watchFolderInput) watchFolderInput.value = this.config.watchFolder || '';
    if (apiKeyInput) apiKeyInput.value = this.config.openaiApiKey || '';
    if (modelSelect) modelSelect.value = this.config.llmModel || 'gpt-4.1-nano';
    if (processingModeSelect) processingModeSelect.value = this.config.processingMode || 'accuracy';
    if (lowercaseCheckbox) lowercaseCheckbox.checked = this.config.useLowercase !== false; // Default to true
    if (autoOrganizeCheckbox) autoOrganizeCheckbox.checked = this.config.autoOrganize !== false; // Default to true
    if (autoOrganizeThreshold) autoOrganizeThreshold.value = String(this.config.autoOrganizeThreshold || 10);
    
    // Show/hide API key banner based on model selection
    const banner = document.getElementById('api-key-banner');
    if (banner) {
      const selectedModel = this.config.llmModel || 'gpt-4.1-nano';
      const isOpenAIModel = !selectedModel.startsWith('ollama:');
      
      if (!this.config.openaiApiKey && isOpenAIModel) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }
  
  private setupEventListeners() {
    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', async () => {
      await this.loadOllamaModels();
      document.getElementById('settings-modal')?.classList.remove('hidden');
      // Re-set the model value after loading Ollama models
      const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
      if (modelSelect && this.config.llmModel) {
        modelSelect.value = this.config.llmModel;
        // Trigger change event to update API key field state
        modelSelect.dispatchEvent(new Event('change'));
      }
    });
    
    // Banner settings button
    document.getElementById('banner-settings-btn')?.addEventListener('click', async () => {
      await this.loadOllamaModels();
      document.getElementById('settings-modal')?.classList.remove('hidden');
      // Re-set the model value after loading Ollama models
      const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
      if (modelSelect && this.config.llmModel) {
        modelSelect.value = this.config.llmModel;
        // Trigger change event to update API key field state
        modelSelect.dispatchEvent(new Event('change'));
      }
    });
    
    // Close settings
    document.getElementById('close-settings')?.addEventListener('click', () => {
      document.getElementById('settings-modal')?.classList.add('hidden');
    });
    
    // Select folder
    document.getElementById('select-folder')?.addEventListener('click', async () => {
      const folder = await window.electronAPI.selectFolder();
      if (folder) {
        const input = document.getElementById('watch-folder-input') as HTMLInputElement;
        input.value = folder;
      }
    });
    
    // Save settings
    document.getElementById('save-settings')?.addEventListener('click', async () => {
      const watchFolder = (document.getElementById('watch-folder-input') as HTMLInputElement).value;
      const openaiApiKey = (document.getElementById('api-key-input') as HTMLInputElement).value;
      const llmModel = (document.getElementById('model-select') as HTMLSelectElement).value;
      const processingMode = (document.getElementById('processing-mode-select') as HTMLSelectElement).value;
      const useLowercase = (document.getElementById('lowercase-checkbox') as HTMLInputElement).checked;
      const autoOrganize = (document.getElementById('auto-organize-checkbox') as HTMLInputElement).checked;
      const autoOrganizeThreshold = parseInt((document.getElementById('auto-organize-threshold') as HTMLInputElement).value) || 10;
      
      try {
        await window.electronAPI.updateConfig({
          watchFolder,
          openaiApiKey,
          llmModel,
          processingMode,
          useLowercase,
          autoOrganize,
          autoOrganizeThreshold
        });
        
        this.config = { watchFolder, openaiApiKey, llmModel, processingMode, useLowercase, autoOrganize, autoOrganizeThreshold };
        this.updateUI();
        document.getElementById('settings-modal')?.classList.add('hidden');
        
        await window.electronAPI.showNotification('Settings Saved', 'Configuration updated successfully');
      } catch (error) {
        errorLog('Failed to save settings:', error);
        await window.electronAPI.showNotification('Error', 'Failed to save settings');
      }
    });
    
    // Open folder button
    document.getElementById('open-folder')?.addEventListener('click', () => {
      window.electronAPI.openFolder();
    });
    
    // Organize now button
    document.getElementById('organize-now')?.addEventListener('click', async () => {
      const button = document.getElementById('organize-now') as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.textContent = 'Organizing...';
      }
      
      try {
        const result = await window.electronAPI.organizeFiles();
        if (result.success) {
          await window.electronAPI.showNotification(
            'Organization Complete',
            `${result.movedFiles} files have been organized`
          );
        } else {
          await window.electronAPI.showNotification(
            'Organization Failed',
            result.error || 'Unknown error occurred'
          );
        }
      } catch (error) {
        errorLog('Failed to organize files:', error);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Organize Now';
        }
        await this.updateInboxCount();
      }
    });
    
    // Reorganize all button
    document.getElementById('reorganize-all')?.addEventListener('click', async () => {
      const button = document.getElementById('reorganize-all') as HTMLButtonElement;
      
      // Confirm with user since this is a major operation
      const confirmDialog = confirm(
        'This will analyze ALL files in your File Wrangler folder and reorganize them for optimal categorization.\n\n' +
        'Files may be moved to different categories based on the overall document collection.\n\n' +
        'Do you want to continue?'
      );
      
      if (!confirmDialog) {
        return;
      }
      
      if (button) {
        button.disabled = true;
        button.textContent = '🔄 Reorganizing...';
      }
      
      try {
        const result = await window.electronAPI.reorganizeAllFiles();
        if (result.success) {
          await window.electronAPI.showNotification(
            'Reorganization Complete',
            `${result.movedFiles} files have been reorganized into optimal folders`
          );
        } else {
          await window.electronAPI.showNotification(
            'Reorganization Failed',
            result.error || 'Unknown error occurred'
          );
        }
      } catch (error) {
        errorLog('Failed to reorganize files:', error);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = '🔄 Reorganize All Files';
        }
        await this.updateInboxCount();
      }
    });
    
    // Close modal on background click
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('settings-modal')?.classList.add('hidden');
      }
    });
    
    // Update API key requirement when model changes
    document.getElementById('model-select')?.addEventListener('change', (e) => {
      const selectedModel = (e.target as HTMLSelectElement).value;
      const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
      const isOllamaModel = selectedModel.startsWith('ollama:');
      
      // Update API key input requirement indicator
      if (apiKeyInput) {
        apiKeyInput.placeholder = isOllamaModel ? 'Not required for Ollama' : 'sk-...';
        apiKeyInput.disabled = isOllamaModel;
      }
    });
  }
  
  private setupIPCListeners() {
    // Listen for new PDFs
    window.electronAPI.onPDFAdded((filePath) => {
      const filename = filePath.split('/').pop() || filePath;
      this.addActivity({
        id: Date.now().toString(),
        filename,
        status: 'parsing',
        message: 'Processing PDF...',
        timestamp: new Date()
      });
    });
    
    // Listen for processing updates
    window.electronAPI.onProcessingUpdate((data) => {
      const filename = (data.originalPath || data.path).split('/').pop() || data.path;
      const activity = this.activities.find(a => a.filename === filename);
      
      if (activity) {
        activity.status = data.status;
        
        // Store the new filename if available
        if (data.newPath) {
          activity.newFilename = data.newPath.split('/').pop() || data.newPath;
        }
        
        switch (data.status) {
          case 'parsing':
            activity.message = 'Parsing PDF content...';
            break;
          case 'extracting':
            activity.message = 'Extracting metadata with AI...';
            break;
          case 'renaming':
            activity.message = 'Renaming file...';
            break;
          case 'completed':
            if (activity.newFilename) {
              activity.message = `Renamed to: ${activity.newFilename}`;
            } else {
              activity.message = `Renamed successfully`;
            }
            // Update inbox count after successful processing
            this.updateInboxCount();
            break;
          case 'error':
            activity.message = `Error: ${data.error || 'Unknown error'}`;
            break;
        }
        
        this.updateActivityList();
      }
    });
    
    // Listen for organization status updates
    window.electronAPI.onOrganizationStatus(async (data) => {
      if (data.status === 'complete') {
        await this.updateInboxCount();
      }
    });
  }
  
  private async updateInboxCount() {
    try {
      const count = await window.electronAPI.getInboxCount();
      const inboxCountEl = document.getElementById('inbox-count');
      if (inboxCountEl) {
        inboxCountEl.textContent = `${count} file${count !== 1 ? 's' : ''} in inbox`;
      }
    } catch (error) {
      errorLog('Failed to update inbox count:', error);
    }
  }
  
  private addActivity(activity: ActivityItem) {
    this.activities.unshift(activity);
    if (this.activities.length > 50) {
      this.activities = this.activities.slice(0, 50);
    }
    this.updateActivityList();
  }
  
  private updateActivityList() {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;
    
    if (this.activities.length === 0) {
      listEl.innerHTML = '<p class="empty-state">Waiting for PDF files...</p>';
      return;
    }
    
    listEl.innerHTML = this.activities
      .map(activity => `
        <div class="activity-item">
          <div class="activity-status ${activity.status}"></div>
          <div class="activity-content">
            <div class="activity-filename">${activity.filename}${activity.newFilename && activity.status === 'completed' ? ` → ${activity.newFilename}` : ''}</div>
            <div class="activity-message">${activity.message}</div>
          </div>
        </div>
      `)
      .join('');
  }
  
  private async loadOllamaModels() {
    const selectEl = document.getElementById('model-select') as HTMLSelectElement;
    const statusEl = document.getElementById('ollama-status');
    
    try {
      // Request Ollama models from main process
      const models = await window.electronAPI.getOllamaModels();
      
      if (models && models.length > 0) {
        // Remove existing Ollama optgroup if it exists
        const existingOllama = selectEl.querySelector('optgroup[label="Ollama (Local)"]');
        if (existingOllama) {
          existingOllama.remove();
        }
        
        // Create new optgroup with fetched models
        const ollamaGroup = document.createElement('optgroup');
        ollamaGroup.label = 'Ollama (Local)';
        
        models.forEach((model: any) => {
          const option = document.createElement('option');
          option.value = `ollama:${model.name}`;
          option.textContent = model.name;
          ollamaGroup.appendChild(option);
        });
        
        selectEl.appendChild(ollamaGroup);
        
        if (statusEl) {
          statusEl.textContent = `✓ ${models.length} Ollama model${models.length > 1 ? 's' : ''} available`;
          statusEl.classList.remove('error');
        }
      } else {
        if (statusEl) {
          statusEl.textContent = 'No Ollama models found. Install models with: ollama pull <model>';
          statusEl.classList.add('error');
        }
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = 'Ollama not running. Start with: ollama serve';
        statusEl.classList.add('error');
      }
    }
  }
}

// Note: PDF conversion now happens in main process with pdf2img-electron

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Set the app icon
  const appIcon = document.querySelector('.app-icon') as HTMLImageElement;
  if (appIcon) {
    appIcon.src = iconPath;
  }
  
  new PDFRenamerApp();
  
  // Add debug logging
  window.electronAPI.onDebugLog((message: string) => {
    devLog('[Debug]', message);
    // In production, you could still show debug messages in UI if needed
    // For now, just log to console in dev mode
  });
  
});