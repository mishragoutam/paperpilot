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
import './App.css';

const App: React.FC = () => {
  const { init, initialized, leftPanelOpen, rightPanelOpen, currentView } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    let compact = window.innerWidth < 1150;
    const closePanels = () => {
      const state = useAppStore.getState();
      if (state.leftPanelOpen) state.toggleLeftPanel();
      if (state.rightPanelOpen) state.toggleRightPanel();
    };

    if (compact) closePanels();

    const handleResize = () => {
      const nextCompact = window.innerWidth < 1150;
      if (nextCompact && !compact) closePanels();
      compact = nextCompact;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-on-surface">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[24px] animate-spin" style={{ animationDuration: '1.5s' }}>
              progress_activity
            </span>
          </div>
          <div className="text-center">
            <p className="font-label-md text-sm font-semibold text-on-surface">PaperPilot</p>
            <p className="font-label-sm text-xs text-on-surface-variant mt-1">Initializing your research workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  const isWorkspace = currentView === 'workspace';

  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Header />

      {/* Sidebar — only in workspace view */}
      {isWorkspace && <Sidebar />}

      {/* Main content area with smooth sidebar offset */}
      <div
        className="app-content pt-[72px] transition-[padding-left] duration-200 ease-out"
        style={{ paddingLeft: isWorkspace ? '256px' : '0px' }}
      >
        <main className={`h-[calc(100vh-72px)] flex overflow-hidden bg-surface-container-low text-on-surface ${isWorkspace ? 'workspace-main' : ''}`}>
          {currentView === 'library' && (
            <div className="flex-1 animate-fade-slide-in">
              <ProjectsLibrary />
            </div>
          )}
          {currentView === 'originality' && (
            <div className="flex-1 animate-fade-slide-in">
              <OriginalityReport />
            </div>
          )}
          {currentView === 'settings' && (
            <div className="flex-1 animate-fade-slide-in">
              <Settings />
            </div>
          )}
          {isWorkspace && (
            <>
              {leftPanelOpen && (
                <div className="panel-enter">
                  <ResearchDesk />
                </div>
              )}

              <section className="flex-1 h-full flex flex-col bg-surface-container-low overflow-hidden relative border-r border-surface-container">
                <Editor />
              </section>

              {rightPanelOpen && (
                <div className="panel-enter-right">
                  <Chatbot />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
