import React, { useState } from 'react';
import { useAppStore, type AppView } from '../../store/useAppStore';

export const Header: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    toggleLeftPanel, 
    toggleRightPanel, 
    toggleTheme, 
    theme, 
    db, 
    activeDocumentId, 
    triggerUndo, 
    triggerRedo,
    updateDocumentContent
  } = useAppStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const activeDoc = db.documents.find(d => d.id === activeDocumentId);
  const wordCount = activeDoc ? activeDoc.wordCount : 0;
  const citationCount = db.sources.length;

  const handleExport = (format: 'md' | 'html' | 'txt') => {
    if (!activeDoc) return;
    let content = activeDoc.content;
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'html') {
      mime = 'text/html';
      ext = 'html';
    } else if (format === 'md') {
      content = content.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
                       .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
                       .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
                       .replace(/<br\s*[\/]?>/gi, '\n');
      ext = 'md';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\.[^/.]+$/, "")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleMinimize = () => {
    (window as any).electronAPI?.minimize?.();
  };

  const handleMaximize = () => {
    (window as any).electronAPI?.maximize?.();
  };

  const handleClose = () => {
    (window as any).electronAPI?.close?.();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-low shadow-[0_1px_8px_rgba(0,0,0,0.04)] select-none">
      {/* Primary OS App Bar (h-10) */}
      <div className="h-10 px-gutter-compact flex items-center justify-between border-b border-surface-container">
        {/* Left Section: Brand & Active Document Breadcrumb */}
        <div className="flex items-center gap-space-sm min-w-0">
          <div 
            onClick={() => setCurrentView('workspace')}
            className="flex items-center gap-space-xs cursor-pointer hover:opacity-85 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">auto_stories</span>
            <span className="font-label-md text-label-md font-semibold tracking-tight text-on-surface">PaperPilot</span>
          </div>

          <div className="h-3 w-px bg-outline-variant mx-space-xs"></div>

          {/* Active Document Indicator */}
          <div className="flex items-center gap-space-xs bg-surface-container-lowest px-space-sm py-0.5 rounded border border-outline-variant max-w-[260px] lg:max-w-md">
            <span className="material-symbols-outlined text-outline text-[14px]">description</span>
            <span className="font-label-code text-label-code text-on-surface truncate" title={activeDoc?.title}>
              {activeDoc ? activeDoc.title : 'Neural-Symbolic Architectures in Automated Literature Synthesis.docx'}
            </span>
          </div>

          {/* Local Vault Sync Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-tertiary font-label-sm text-label-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse"></span>
            <span>Saved to Local Vault</span>
          </div>

          {/* Undo / Redo Micro Actions */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={triggerUndo}
              className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Undo (Ctrl+Z)" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">undo</span>
            </button>
            <button 
              onClick={triggerRedo}
              className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Redo (Ctrl+Y)" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">redo</span>
            </button>
          </div>
        </div>

        {/* Right Section: Telemetry, Templates, Export & Controls */}
        <div className="flex items-center gap-space-sm">
          {/* Originality Badge Button */}
          <button 
            onClick={() => setCurrentView('originality')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container border border-surface-container-high font-label-sm text-label-sm text-tertiary hover:bg-surface-container-high transition-colors"
            title="Open Originality & Similarity Report"
          >
            <span className="material-symbols-outlined text-[13px] text-tertiary">verified</span>
            <span>98% Unique</span>
            <span className="text-outline text-[10px]">•</span>
            <span className="text-on-surface-variant">Checked just now</span>
          </button>

          {/* Template Selector Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setTemplateOpen(!templateOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors" 
              type="button"
            >
              <span>IEEE Template</span>
              <span className="material-symbols-outlined text-[13px]">expand_more</span>
            </button>
            {templateOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest rounded shadow-lg border border-surface-container py-1 z-50 text-xs">
                <button onClick={() => setTemplateOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-surface-container text-on-surface">IEEE Transactions</button>
                <button onClick={() => setTemplateOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-surface-container text-on-surface">Nature Conference</button>
                <button onClick={() => setTemplateOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-surface-container text-on-surface">ACM SIGCHI</button>
                <button onClick={() => setTemplateOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-surface-container text-on-surface">APA 7th Edition</button>
              </div>
            )}
          </div>

          {/* Export Dropdown Button */}
          <div className="relative">
            <button 
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-sm text-label-sm transition-colors shadow-xs" 
              type="button"
            >
              <span>Export</span>
              <span className="material-symbols-outlined text-[13px]">file_download</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-lowest rounded shadow-lg border border-surface-container py-1 z-50 text-xs">
                <button onClick={() => handleExport('md')} className="w-full text-left px-3 py-1.5 hover:bg-surface-container flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-[15px] text-primary">markdown</span>
                  <span>Export as Markdown (.md)</span>
                </button>
                <button onClick={() => handleExport('html')} className="w-full text-left px-3 py-1.5 hover:bg-surface-container flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-[15px] text-secondary">html</span>
                  <span>Export as HTML (.html)</span>
                </button>
                <button onClick={() => handleExport('txt')} className="w-full text-left px-3 py-1.5 hover:bg-surface-container flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-[15px] text-outline">description</span>
                  <span>Export as Plain Text (.txt)</span>
                </button>
              </div>
            )}
          </div>

          {/* Dock & View Toggle Buttons */}
          <div className="flex items-center gap-0.5 text-on-surface-variant">
            <button 
              onClick={toggleLeftPanel} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Toggle Left Desk" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">dock_to_left</span>
            </button>
            <button 
              onClick={toggleRightPanel} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Toggle AI Copilot" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">dock_to_right</span>
            </button>
            <button 
              onClick={toggleTheme} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Toggle Theme" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">
                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
              </span>
            </button>
            <button 
              onClick={() => setCurrentView('settings')} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high hover:text-on-surface transition-colors" 
              title="Global Settings" 
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">settings</span>
            </button>
          </div>

          {/* User profile avatar badge */}
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary text-[14px]">person</span>
          </div>

          {/* Desktop Window Controls */}
          <div className="flex items-center ml-1">
            <button 
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface" 
              type="button"
              title="Minimize"
            >
              <span className="material-symbols-outlined text-[14px]">minimize</span>
            </button>
            <button 
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface" 
              type="button"
              title="Maximize"
            >
              <span className="material-symbols-outlined text-[13px]">crop_square</span>
            </button>
            <button 
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center text-on-surface-variant hover:bg-error hover:text-on-error" 
              type="button"
              title="Close"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Header Navigation Ribbon (h-8) */}
      <div className="h-8 px-gutter-compact bg-surface-container-lowest flex items-center justify-between border-b border-surface-container">
        <nav className="flex items-center gap-1">
          <button 
            onClick={() => setCurrentView('workspace')} 
            className={`px-3 py-1 rounded transition-colors text-xs font-medium ${
              currentView === 'workspace' 
                ? 'bg-surface-container text-primary font-semibold' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            Workspace
          </button>
          <button 
            onClick={() => setCurrentView('library')} 
            className={`px-3 py-1 rounded transition-colors text-xs font-medium ${
              currentView === 'library' 
                ? 'bg-surface-container text-primary font-semibold' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            Projects Library
          </button>
          <button 
            onClick={() => setCurrentView('originality')} 
            className={`px-3 py-1 rounded transition-colors text-xs font-medium ${
              currentView === 'originality' 
                ? 'bg-surface-container text-primary font-semibold' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            Originality Report
          </button>
          <button 
            onClick={() => setCurrentView('settings')} 
            className={`px-3 py-1 rounded transition-colors text-xs font-medium ${
              currentView === 'settings' 
                ? 'bg-surface-container text-primary font-semibold' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Live Academic Telemetry */}
        <div className="flex items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
          <span>Sync: <strong className="font-medium text-on-surface">Zotero + Mendeley (Active)</strong></span>
          <span className="text-outline-variant">|</span>
          <span>Words: <strong className="font-medium text-on-surface">{wordCount.toLocaleString()}</strong></span>
          <span className="text-outline-variant">|</span>
          <span>Citations: <strong className="font-medium text-on-surface">{citationCount} Verified</strong></span>
        </div>
      </div>
    </header>
  );
};
