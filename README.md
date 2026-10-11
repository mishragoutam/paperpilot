# PaperPilot

An AI-powered research paper writing, research discovery, and originality-analysis desktop application for students and researchers.

## Overview
PaperPilot provides a comprehensive three-panel workspace to aid the academic writing process:
1. **Research Desk (Left Panel):** Search for context and reference materials.
2. **Editor (Center Panel):** A rich-text, Tiptap-powered document editor designed for academic writing.
3. **AI Assistant (Right Panel):** A chat assistant utilizing the Google Gemini API to help synthesize research.

## Technologies Used
- **Electron:** Cross-platform desktop application packaging.
- **React & Vite:** Fast frontend rendering and bundling.
- **TypeScript:** Type-safe application development.
- **Zustand:** Predictable and lightweight state management.
- **Tiptap / ProseMirror:** Extensible rich-text editing.
- **Tailwind CSS:** Styling using design tokens extracted from the Stitch reference UI.
- **Local Persistence:** Versioned JSON local-file persistence to store projects, documents, and settings reliably without native SQLite compilation overhead in Electron.

## Prerequisites
- Node.js (v18 or newer)
- npm (v9 or newer)

## Installation
1. Clone or extract the project repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Development
Run the development server with Hot Module Replacement (HMR) and Electron:
```bash
npm run dev
```

## Build and Packaging
To build the application for your operating system:
```bash
npm run build
```
This will compile the TypeScript, build the Vite bundle, and package the application using `electron-builder`. The output will be in the `release/` directory. (Note: On some systems, creating Windows installers requires Admin rights or Developer Mode enabled due to symlink requirements in code signing dependencies).

## Configuration & API Keys
To use the online research and AI assistant features, you must configure your API keys within the application.
1. Open the **Settings** panel from the top right of the application header.
2. Enter your **Google Gemini API Key** and **Tavily Search API Key** (or another configured provider).
3. Changes are saved locally and immediately applied.

**Privacy Note:** 
When the "Automatic Originality & Similarity Monitor" is enabled (off by default), small portions of your active document's text will be securely transmitted to the configured search API provider to check for unreferenced matches. This is a heuristic online similarity checker, not a certified plagiarism detector. Your full manuscript is **never** uploaded by default, and you can disable remote checking completely via the Settings panel.

## Troubleshooting
- **Missing Module or Syntax Errors:** If you see Vite compilation errors, ensure you've run `npm install --legacy-peer-deps` since some Vite plugins expect Vite 6 while the template might use Vite 5.
- **White Screen in Electron:** Use `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools and check for missing API keys or syntax errors in the bundled script.
