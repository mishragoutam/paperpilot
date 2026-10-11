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
  
  // Actions
  init: () => Promise<void>;
  setCurrentView: (view: AppView) => void;
  createProject: (title: string, description: string, template?: string) => Promise<Project>;
  openProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  createDocument: (projectId: string, title: string, content?: string) => Promise<Document>;
  setActiveDocument: (id: string | null) => void;
  updateDocumentContent: (id: string, content: string, wordCount: number) => Promise<void>;
  addSources: (newSources: Source[]) => Promise<void>;
  insertCitation: (citation: string) => void;
  clearPendingCitation: () => void;
  triggerUndo: () => void;
  triggerRedo: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleTheme: () => void;
}

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

  init: async () => {
    const db = await dbService.readDb();
    const firstProject = db.projects[0];
    const firstDoc = firstProject ? db.documents.find(d => d.projectId === firstProject.id) : null;

    set({ 
      db, 
      initialized: true,
      activeProjectId: firstProject ? firstProject.id : null,
      activeDocumentId: firstDoc ? firstDoc.id : null,
      theme: db.settings?.theme === 'dark' ? 'dark' : 'light'
    });

    if (db.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  setCurrentView: (view: AppView) => set({ currentView: view }),

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

  setActiveProject: (id: string | null) => {
    const { db } = get();
    const doc = id ? db.documents.find(d => d.projectId === id) : null;
    set({ activeProjectId: id, activeDocumentId: doc ? doc.id : null });
  },

  createDocument: async (projectId: string, title: string, content: string = '') => {
    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      projectId,
      title,
      content,
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newDb = { ...get().db, documents: [...get().db.documents, newDoc] };
    await dbService.writeDb(newDb);
    set({ db: newDb, activeDocumentId: newDoc.id });
    return newDoc;
  },

  setActiveDocument: (id: string | null) => set({ activeDocumentId: id }),

  updateDocumentContent: async (id: string, content: string, wordCount: number) => {
    const { db } = get();
    const updatedDocs = db.documents.map(d => 
      d.id === id ? { ...d, content, wordCount, updatedAt: new Date().toISOString() } : d
    );
    const newDb = { ...db, documents: updatedDocs };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  addSources: async (newSources: Source[]) => {
    const { db } = get();
    const existingTitles = new Set(db.sources.map(s => s.title.toLowerCase().trim()));
    const uniqueNew = newSources.filter(s => !existingTitles.has(s.title.toLowerCase().trim()));
    const newDb = { ...db, sources: [...uniqueNew, ...db.sources] };
    set({ db: newDb });
    await dbService.writeDb(newDb);
  },

  insertCitation: (citation: string) => set({ pendingCitation: citation }),
  clearPendingCitation: () => set({ pendingCitation: null }),

  triggerUndo: () => set(state => ({ undoTrigger: state.undoTrigger + 1 })),
  triggerRedo: () => set(state => ({ redoTrigger: state.redoTrigger + 1 })),

  toggleLeftPanel: () => set(state => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
  
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
