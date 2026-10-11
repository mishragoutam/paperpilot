import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, db, activeProjectId, createDocument } = useAppStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');

  const activeProject = db.projects.find(p => p.id === activeProjectId);
  const projectDocs = db.documents.filter(d => d.projectId === activeProjectId);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !activeProjectId) return;
    await createDocument(activeProjectId, newDocTitle.trim());
    setNewDocTitle('');
    setCreatingDoc(false);
  };

  return (
    <aside className="fixed left-0 top-[72px] bottom-0 w-64 bg-surface-container-low z-40 flex flex-col border-r border-surface-container select-none">
      {/* Sidebar Header */}
      <div className="p-space-sm flex items-center justify-between border-b border-surface-container">
        <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant tracking-wider">
          Workspace Outline
        </span>
        <button 
          onClick={() => setCreatingDoc(true)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors" 
          type="button"
          title="Add Section / Document"
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
        </button>
      </div>

      {/* Quick Filter */}
      <div className="p-space-xs border-b border-surface-container">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant">
          <span className="material-symbols-outlined text-outline text-[14px]">search</span>
          <input 
            className="w-full bg-transparent font-label-sm text-label-sm text-on-surface focus:outline-none placeholder:text-outline" 
            placeholder="Filter outline, references (⌘K)..." 
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {creatingDoc && (
        <form onSubmit={handleCreateDoc} className="p-2 border-b border-surface-container bg-surface-container-lowest">
          <input
            autoFocus
            type="text"
            placeholder="Document title..."
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            className="w-full text-xs p-1.5 border border-primary rounded bg-surface text-on-surface focus:outline-none mb-1.5"
          />
          <div className="flex justify-end gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setCreatingDoc(false)}
              className="px-2 py-0.5 rounded text-outline hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-medium"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Navigation Tree */}
      <nav className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
        <button 
          onClick={() => setCurrentView('workspace')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'workspace' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">article</span>
            <span className="truncate">Manuscript Draft</span>
          </span>
          <span className="text-outline text-[11px] shrink-0">Sec 4</span>
        </button>

        <button 
          onClick={() => setCurrentView('library')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'library' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">folder_copy</span>
            <span className="truncate">Corpus &amp; References</span>
          </span>
          <span className="text-outline text-[11px] shrink-0">{db.sources.length}</span>
        </button>

        <button 
          onClick={() => setCurrentView('originality')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'originality' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            <span className="truncate">Audit &amp; Integrity</span>
          </span>
          <span className="text-tertiary font-medium text-[11px] shrink-0">98%</span>
        </button>

        <button 
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'settings' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="truncate">Citation Styles &amp; LaTeX</span>
          </span>
        </button>
      </nav>

      {/* Engine Status Footer */}
      <div className="p-space-sm border-t border-surface-container bg-surface-container-lowest">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Local Vault Engine</span>
          </span>
          <span className="font-label-code text-label-code text-outline">v3.2.1</span>
        </div>
      </div>
    </aside>
  );
};
