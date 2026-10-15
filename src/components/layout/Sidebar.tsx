import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    db, 
    activeProjectId, 
    activeDocumentId, 
    setActiveDocument, 
    createDocument,
    deleteDocument 
  } = useAppStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');

  const activeProject = db.projects.find(p => p.id === activeProjectId);
  const allProjectDocs = db.documents.filter(d => d.projectId === activeProjectId);

  const filteredDocs = allProjectDocs.filter(d => 
    !filterQuery.trim() || d.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !activeProjectId) return;
    await createDocument(activeProjectId, newDocTitle.trim());
    setNewDocTitle('');
    setCreatingDoc(false);
  };

  const handleDeleteDoc = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (allProjectDocs.length <= 1) {
      alert('Projects must contain at least one document section.');
      return;
    }
    if (confirm('Are you sure you want to delete this document section?')) {
      await deleteDocument(docId);
    }
  };

  return (
    <aside className="fixed left-0 top-[72px] bottom-0 w-64 bg-surface-container-low z-40 flex flex-col border-r border-surface-container select-none">
      {/* Sidebar Header & Active Project Breadcrumb */}
      <div className="p-space-sm border-b border-surface-container bg-surface-container-low">
        <div className="flex items-center justify-between mb-1">
          <span className="font-label-sm text-[11px] uppercase font-semibold text-on-surface-variant tracking-wider">
            Project Sections
          </span>
          <button 
            onClick={() => setCreatingDoc(true)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-primary hover:text-primary-container transition-colors" 
            type="button"
            title="Add Section / Document"
          >
            <span className="material-symbols-outlined text-[16px]">add_box</span>
          </button>
        </div>
        {activeProject && (
          <div className="text-[11px] font-medium text-on-surface truncate" title={activeProject.title}>
            {activeProject.title}
          </div>
        )}
      </div>

      {/* Quick Filter */}
      <div className="p-space-xs border-b border-surface-container">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant">
          <span className="material-symbols-outlined text-outline text-[14px]">search</span>
          <input 
            className="w-full bg-transparent font-label-sm text-label-sm text-on-surface focus:outline-none placeholder:text-outline" 
            placeholder="Filter sections... (⌘K)" 
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} className="text-outline hover:text-on-surface text-[12px]">✕</button>
          )}
        </div>
      </div>

      {/* Add Document Inline Form */}
      {creatingDoc && (
        <form onSubmit={handleCreateDoc} className="p-2 border-b border-surface-container bg-surface-container-lowest animate-in fade-in duration-150">
          <input
            autoFocus
            type="text"
            placeholder="e.g. 2. Methodology & System Architecture"
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
              Add Section
            </button>
          </div>
        </form>
      )}

      {/* Section 1: Dynamic Manuscript Documents Tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5">
        <div className="px-2 py-1 text-[10px] font-semibold text-outline uppercase tracking-wider flex items-center justify-between">
          <span>Manuscript Sections</span>
          <span>{allProjectDocs.length}</span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-3 text-center text-xs text-outline italic">
            No matching sections found.
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isActive = currentView === 'workspace' && doc.id === activeDocumentId;
            return (
              <div
                key={doc.id}
                onClick={() => {
                  setActiveDocument(doc.id);
                  setCurrentView('workspace');
                }}
                className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-all ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isActive ? 'text-primary' : 'text-outline'}`}>
                    description
                  </span>
                  <span className="truncate text-xs" title={doc.title}>
                    {doc.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-label-code text-[10px] text-outline">
                    {doc.wordCount.toLocaleString()}w
                  </span>
                  {allProjectDocs.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteDoc(e, doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-error text-outline transition-opacity rounded"
                      title="Delete section"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Section 2: Quick Tool Navigation */}
        <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-outline uppercase tracking-wider border-t border-surface-container mt-2">
          Workspace Modules
        </div>

        <button 
          onClick={() => setCurrentView('library')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'library' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-xs'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">folder_copy</span>
            <span className="truncate">Projects &amp; Corpus</span>
          </span>
          <span className="font-label-code text-[10px] text-outline">{db.projects.length}</span>
        </button>

        <button 
          onClick={() => setCurrentView('originality')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'originality' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-xs'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span className="truncate">Originality Audit</span>
          </span>
          <span className="text-tertiary font-medium text-[10px]">98%</span>
        </button>

        <button 
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
            currentView === 'settings' 
              ? 'bg-surface-container-high text-primary font-medium border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-xs'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="truncate">Styles &amp; AI Config</span>
          </span>
        </button>
      </div>

      {/* Engine Status Footer */}
      <div className="p-space-sm border-t border-surface-container bg-surface-container-lowest">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Local Vault Sync</span>
          </span>
          <span className="font-label-code text-label-code text-outline">{allProjectDocs.length} Secs</span>
        </div>
      </div>
    </aside>
  );
};

