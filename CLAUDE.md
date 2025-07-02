# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application called "File Wrangler" that automatically monitors a folder for PDF files and renames them using AI-powered metadata extraction. The app runs in the system tray and uses OpenAI's API to analyze PDF content and extract meaningful metadata (date, title, addressee) for intelligent file naming.

## Key Commands

### Development
- `npm start` - Start the development server with hot reload
- `npm run lint` - Run ESLint to check TypeScript code quality

### Building & Packaging
- `npm run package` - Package the app for the current platform
- `npm run make` - Create platform-specific installers/distributables
- `npm run publish` - Publish the packaged app

## Architecture

### Process Architecture
The app follows Electron's multi-process architecture:
- **Main Process** (`src/index.ts`): Manages app lifecycle, file watching, PDF processing pipeline, and IPC communication
- **Renderer Process** (`src/renderer.ts`): Handles UI rendering and user interactions
- **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer processes using contextBridge

### AI Processing Pipeline
The app uses LangGraph's StateGraph pattern for PDF processing:
1. **File Detection**: Chokidar watches for new PDF files
2. **Text Extraction**: pdf2json extracts text, with OCR fallback via pdf-to-png-converter and @cherrystudio/mac-system-ocr
3. **AI Analysis**: OpenAI API analyzes content to extract metadata
4. **File Renaming**: Files are renamed to format: `${date} ${title} [${addressee}].pdf`

### Key Technologies
- **Electron 37.1.0** with TypeScript
- **Webpack** via Electron Forge for bundling
- **LangChain/LangGraph** for AI workflow orchestration
- **electron-store** for persistent configuration

### Configuration
Settings are stored persistently and include:
- Watch folder path
- OpenAI API key
- Model selection (gpt-4.1-nano, gpt-4.1)
- Lowercase filename option

## Development Notes

- The app uses Webpack configuration from Electron Forge's webpack plugin
- TypeScript is configured with strict mode disabled
- ESLint is configured for TypeScript with import plugin
- Native modules are automatically unpacked via Electron Forge plugin
- Security hardening is applied through Electron Fuses
- PDF.js worker file is copied to output directory via CopyWebpackPlugin to enable PDF processing

## Important File Locations

- Main process entry: `src/index.ts`
- Renderer entry: `src/renderer.ts`
- AI pipeline: `src/pipelines/pdf-pipeline.ts`
- IPC handlers: `src/handlers/ipc-handlers.ts`
- Configuration: `forge.config.ts` and `webpack.*.config.ts`