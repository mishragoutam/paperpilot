import React, { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Editor } from './components/editor/Editor';
import { ResearchDesk } from './components/research/ResearchDesk';
import { Chatbot } from './components/assistant/Chatbot';
import { ProjectsLibrary } from './components/library/ProjectsLibrary';
import { OriginalityReport } from './components/originality/OriginalityReport';
import { Settings } from './components/settings/Settings';
import { useAppStore } from './store/useAppStore';

const App: React.FC = () => {
  const { init, initialized, leftPanelOpen, rightPanelOpen, currentView, ribbonCollapsed } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-on-surface font-label-md text-xs gap-2">
        <span className="material-symbols-outlined animate-spin text-primary text-[20px]">progress_activity</span>
        <span>Initializing PaperPilot Vault...</span>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Header />

      {currentView === 'workspace' && <Sidebar />}

      <div className={currentView === 'workspace' ? "pl-64 pt-[72px]" : "pt-[72px]"}>
        <main className="h-[calc(100vh-72px)] flex overflow-hidden bg-surface-container-low text-on-surface">
          {currentView === 'library' && <ProjectsLibrary />}
          {currentView === 'originality' && <OriginalityReport />}
          {currentView === 'settings' && <Settings />}
          {currentView === 'workspace' && (
            <>
              {leftPanelOpen && <ResearchDesk />}

              <section className="flex-1 h-full flex flex-col bg-surface-container-low overflow-hidden relative border-r border-surface-container">
                <Editor />
              </section>

              {rightPanelOpen && <Chatbot />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
