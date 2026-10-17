import { create } from 'zustand';
import { dbService } from '../services/db';
import type { Database, Project, Document, Source } from '../services/db';

export type AppView = 'workspace' | 'library' | 'originality' | 'settings';

interface AppState {
  db: Database;
  initialized: boolean;
  currentView: AppView;
  activeProjectId: string | null;
  activeDocumentId: string | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  theme: 'light' | 'dark';
  pendingCitation: string | null;
  undoTrigger: number;
  redoTrigger: number;
  editorInstance: any | null;
  editorTick: number;
  activeRibbonTab: 'file' | 'home' | 'insert' | 'design' | 'layout' | 'references' | 'mailings' | 'review' | 'view' | 'help';
  ribbonCollapsed: boolean;
  aiSpeedMode: 'turbo' | 'balanced' | 'deep';
  
  // Actions
  init: () => Promise<void>;
  setCurrentView: (view: AppView) => void;
  setEditorInstance: (editor: any) => void;
  triggerEditorTick: () => void;
  setActiveRibbonTab: (tab: 'file' | 'home' | 'insert' | 'design' | 'layout' | 'references' | 'mailings' | 'review' | 'view' | 'help') => void;
  toggleRibbonCollapsed: () => void;
  setAiSpeedMode: (mode: 'turbo' | 'balanced' | 'deep') => void;
  createProject: (title: string, description: string, template?: string) => Promise<Project>;
  openProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  deleteProject: (id: string) => Promise<void>;
  updateProjectTemplate: (projectId: string, template: string) => Promise<void>;
  createDocument: (projectId: string, title: string, content?: string) => Promise<Document>;
  setActiveDocument: (id: string | null) => void;
  updateDocumentTitle: (id: string, title: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocumentContent: (id: string, content: string, wordCount: number) => Promise<void>;
  addSources: (newSources: Source[]) => Promise<void>;
  markSourceCited: (id: string) => Promise<void>;
  insertCitation: (citation: string) => void;
  clearPendingCitation: () => void;
  triggerUndo: () => void;
  triggerRedo: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleTheme: () => void;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSaveCallbacks: Array<{ resolve: () => void; reject: (reason?: unknown) => void }> = [];
const debouncedWriteDb = (getDb: () => Database) =>
  new Promise<void>((resolve, reject) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    pendingSaveCallbacks.push({ resolve, reject });
    saveTimeout = setTimeout(async () => {
      saveTimeout = null;
      const callbacks = pendingSaveCallbacks;
      pendingSaveCallbacks = [];
      try {
        await dbService.writeDb(getDb());
        callbacks.forEach(callback => callback.resolve());
      } catch (error) {
        callbacks.forEach(callback => callback.reject(error));
      }
    }, 750);
  });

export const useAppStore = create<AppState>((set, get) => ({
  db: { projects: [], documents: [], sources: [], settings: {} },
  initialized: false,
  currentView: 'workspace',
  activeProjectId: null,
  activeDocumentId: null,
  leftPanelOpen: true,
  rightPanelOpen: true,
  theme: 'light',
  pendingCitation: null,
  undoTrigger: 0,
  redoTrigger: 0,
  editorInstance: null,
  editorTick: 0,
  activeRibbonTab: 'home',
  ribbonCollapsed: false,
  aiSpeedMode: 'turbo',

  init: async () => {
    const db = await dbService.readDb();
    const firstProject = db.projects[0];
    const firstDoc = firstProject ? db.documents.find(d => d.projectId === firstProject.id) : null;

    set({ 
      db, 
      initialized: true,
      activeProjectId: firstProject ? firstProject.id : null,
      activeDocumentId: firstDoc ? firstDoc.id : null,
      theme: db.settings?.theme === 'dark' ? 'dark' : 'light',
      aiSpeedMode: db.settings?.speedMode || 'turbo'
    });

    if (db.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  setCurrentView: (view: AppView) => set({ currentView: view }),
  setEditorInstance: (editor: any) => set({ editorInstance: editor }),
  triggerEditorTick: () => set(state => ({ editorTick: state.editorTick + 1 })),
  setActiveRibbonTab: (tab: any) => set({ activeRibbonTab: tab }),
  toggleRibbonCollapsed: () => set(state => ({ ribbonCollapsed: !state.ribbonCollapsed })),
  setAiSpeedMode: (mode: 'turbo' | 'balanced' | 'deep') => set(state => {
    const newDb = { ...state.db, settings: { ...state.db.settings, speedMode: mode } };
    dbService.writeDb(newDb);
    return { aiSpeedMode: mode, db: newDb };
  }),

  openProject: (id: string) => {
    const { db } = get();
    const doc = db.documents.find(d => d.projectId === id);
    set({
      activeProjectId: id,
      activeDocumentId: doc ? doc.id : null,
      currentView: 'workspace'
    });
  },

  createProject: async (title: string, description: string, template: string = 'IEEE Transactions') => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      title,
      description,
      template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      projectId: newProject.id,
      title: `${title} - Draft.docx`,
      content: `<h1>${title}</h1><p>Start writing your manuscript according to ${template} guidelines...</p>`,
      wordCount: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newDb = { 
      ...get().db, 
      projects: [newProject, ...get().db.projects],
      documents: [newDoc, ...get().db.documents]
    };
    
    await dbService.writeDb(newDb);
    set({ 
      db: newDb, 
      activeProjectId: newProject.id,
      activeDocumentId: newDoc.id,
      currentView: 'workspace'
    });
    return newProject;
  },

  deleteProject: async (id: string) => {
    const { db, activeProjectId } = get();
    const remainingProjects = db.projects.filter(p => p.id !== id);
    const remainingDocs = db.documents.filter(d => d.projectId !== id);
    const remainingSources = db.sources.filter(s => s.projectId !== id);
    const newDb = { ...db, projects: remainingProjects, documents: remainingDocs, sources: remainingSources };
    await dbService.writeDb(newDb);
    
    let nextProjId = activeProjectId === id ? (remainingProjects[0]?.id || null) : activeProjectId;
    let nextDoc = nextProjId ? remainingDocs.find(d => d.projectId === nextProjId) : null;
    set({ db: newDb, activeProjectId: nextProjId, activeDocumentId: nextDoc ? nextDoc.id : null });
  },

  updateProjectTemplate: async (projectId: string, template: string) => {
    const { db } = get();
    const updatedProjects = db.projects.map(p => 
      p.id === projectId ? { ...p, template, updatedAt: new Date().toISOString() } : p
    );
    const newDb = { ...db, projects: updatedProjects };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  setActiveProject: (id: string | null) => {
    const { db } = get();
    const doc = id ? db.documents.find(d => d.projectId === id) : null;
    set({ activeProjectId: id, activeDocumentId: doc ? doc.id : null });
  },

  createDocument: async (projectId: string, title: string, content: string = '') => {
    const initialContent = content || `<h2>${title}</h2><p>Begin drafting section content here...</p>`;
    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      projectId,
      title,
      content: initialContent,
      wordCount: initialContent.split(/\s+/).filter(Boolean).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newDb = { ...get().db, documents: [...get().db.documents, newDoc] };
    await dbService.writeDb(newDb);
    set({ db: newDb, activeDocumentId: newDoc.id });
    return newDoc;
  },

  setActiveDocument: (id: string | null) => set({ activeDocumentId: id }),

  updateDocumentTitle: async (id: string, title: string) => {
    const { db } = get();
    const updatedDocs = db.documents.map(d =>
      d.id === id ? { ...d, title, updatedAt: new Date().toISOString() } : d
    );
    const newDb = { ...db, documents: updatedDocs };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  deleteDocument: async (id: string) => {
    const { db, activeDocumentId, activeProjectId } = get();
    const remainingDocs = db.documents.filter(d => d.id !== id);
    const newDb = { ...db, documents: remainingDocs };
    await dbService.writeDb(newDb);

    let nextDocId = activeDocumentId;
    if (activeDocumentId === id) {
      const projDoc = remainingDocs.find(d => d.projectId === activeProjectId);
      nextDocId = projDoc ? projDoc.id : null;
    }
    set({ db: newDb, activeDocumentId: nextDocId });
  },

  updateDocumentContent: async (id: string, content: string, wordCount: number) => {
    const { db } = get();
    const updatedDocs = db.documents.map(d => 
      d.id === id ? { ...d, content, wordCount, updatedAt: new Date().toISOString() } : d
    );
    const newDb = { ...db, documents: updatedDocs };
    // Immediately update memory store so UI is 100% responsive
    set({ db: newDb });
    // Debounce disk I/O to avoid thrashing disk on every single keystroke
    await debouncedWriteDb(() => get().db);
  },

  addSources: async (newSources: Source[]) => {
    const { db } = get();
    const existingTitles = new Set(db.sources.map(s => s.title.toLowerCase().trim()));
    const uniqueNew = newSources.filter(s => !existingTitles.has(s.title.toLowerCase().trim()));
    const newDb = { ...db, sources: [...uniqueNew, ...db.sources] };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  markSourceCited: async (id: string) => {
    const { db } = get();
    const updatedSources = db.sources.map(source => {
      if (source.id !== id || source.notes?.includes('[cited]')) return source;
      return { ...source, notes: `${source.notes ? `${source.notes}\n` : ''}[cited]` };
    });
    if (updatedSources.every((source, index) => source === db.sources[index])) return;
    const newDb = { ...db, sources: updatedSources };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  insertCitation: (citation: string) => set({ pendingCitation: citation }),
  clearPendingCitation: () => set({ pendingCitation: null }),

  triggerUndo: () => set(state => ({ undoTrigger: state.undoTrigger + 1 })),
  triggerRedo: () => set(state => ({ redoTrigger: state.redoTrigger + 1 })),

  toggleLeftPanel: () => set(state => {
    const open = !state.leftPanelOpen;
    return {
      leftPanelOpen: open,
      rightPanelOpen: open && window.innerWidth < 1150 ? false : state.rightPanelOpen,
    };
  }),
  toggleRightPanel: () => set(state => {
    const open = !state.rightPanelOpen;
    return {
      rightPanelOpen: open,
      leftPanelOpen: open && window.innerWidth < 1150 ? false : state.leftPanelOpen,
    };
  }),
  
  toggleTheme: () => set(state => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const newDb = { ...state.db, settings: { ...state.db.settings, theme: newTheme } };
    dbService.writeDb(newDb);
    return { theme: newTheme, db: newDb };
  })
}));
