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
    deleteDocument,
  } = useAppStore();

  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeProject = db.projects.find(p => p.id === activeProjectId);
  const allProjectDocs = db.documents.filter(d => d.projectId === activeProjectId);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !activeProjectId || isCreating) return;
    setIsCreating(true);
    try {
      const doc = await createDocument(activeProjectId, newDocTitle.trim());
      // Explicitly set active document and navigate to workspace
      setActiveDocument(doc.id);
      setCurrentView('workspace');
      setNewDocTitle('');
      setCreatingDoc(false);
    } catch (err) {
      console.error('Failed to create document:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDoc = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (allProjectDocs.length <= 1) {
      alert('A project must have at least one section.');
      return;
    }
    if (confirm('Delete this section?')) {
      await deleteDocument(docId);
    }
  };

  return (
    <aside className="workspace-sidebar fixed left-0 top-14 bottom-0 w-60 bg-surface-container-lowest z-40 flex flex-col border-r border-surface-container select-none">
      {/* Project name */}
      <div className="px-3 py-3 border-b border-surface-container">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] uppercase font-semibold text-outline tracking-wider">Project</span>
          <button
            onClick={() => { setNewDocTitle(''); setCreatingDoc(true); }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-primary transition-colors"
            title="Add page"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
        </div>
        <p className="text-xs font-medium text-on-surface truncate" title={activeProject?.title}>
          {activeProject?.title || 'No project selected'}
        </p>
      </div>

      {/* Add page inline form */}
      {creatingDoc && (
        <form onSubmit={handleCreateDoc} className="px-3 py-2 border-b border-surface-container bg-surface-container-low animate-fade-slide-in">
          <input
            autoFocus
            type="text"
            placeholder="Page title (e.g. Introduction)"
            value={newDocTitle}
            onChange={e => setNewDocTitle(e.target.value)}
            className="w-full text-xs px-2 py-1.5 border border-primary rounded bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setCreatingDoc(false); setNewDocTitle(''); }}
              className="px-2 py-1 text-[11px] rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !newDocTitle.trim()}
              className="px-3 py-1 text-[11px] rounded bg-primary text-white font-medium hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Adding...' : 'Add Page'}
            </button>
          </div>
        </form>
      )}

      {/* Pages list */}
      <div className="flex-1 overflow-y-auto py-1">
        <div className="px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">Pages</span>
          <span className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-outline font-mono">{allProjectDocs.length}</span>
        </div>

        {allProjectDocs.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <span className="material-symbols-outlined text-outline text-[32px] mb-2 block">note_add</span>
            <p className="text-xs text-outline">No pages yet</p>
            <button
              onClick={() => setCreatingDoc(true)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Add first page
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 px-1">
            {allProjectDocs.map(doc => {
              const isActive = currentView === 'workspace' && doc.id === activeDocumentId;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    setActiveDocument(doc.id);
                    setCurrentView('workspace');
                  }}
                  className={`group flex items-center justify-between px-2 py-2 rounded cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className={`material-symbols-outlined text-[14px] shrink-0 ${isActive ? 'text-primary' : 'text-outline'}`}>
                      description
                    </span>
                    <span className="truncate text-xs" title={doc.title}>{doc.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-outline font-mono hidden group-hover:hidden">
                      {doc.wordCount > 0 ? `${doc.wordCount}w` : ''}
                    </span>
                    {allProjectDocs.length > 1 && (
                      <button
                        onClick={e => handleDeleteDoc(e, doc.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 text-outline transition-all rounded"
                        title="Delete page"
                      >
                        <span className="material-symbols-outlined text-[12px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation modules */}
        <div className="mt-4 mx-3 pt-3 border-t border-surface-container">
          <span className="text-[10px] font-semibold text-outline uppercase tracking-wider block mb-1">Modules</span>
          {[
            { view: 'library' as const, icon: 'folder_copy', label: 'Projects Library', badge: String(db.projects.length) },
            { view: 'originality' as const, icon: 'verified', label: 'Originality Check', badge: '' },
            { view: 'settings' as const, icon: 'tune', label: 'Settings', badge: '' },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`w-full flex items-center justify-between px-2 py-2 rounded text-xs transition-all text-left mb-0.5 ${
                currentView === item.view
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.badge && (
                <span className="text-[10px] font-mono text-outline">{item.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Status footer */}
      <div className="px-3 py-2 border-t border-surface-container flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[10px] text-on-surface-variant">Local storage</span>
        <span className="ml-auto text-[10px] font-mono text-outline">{allProjectDocs.length} pages</span>
      </div>
    </aside>
  );
};
