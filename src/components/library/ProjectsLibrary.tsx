import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

const TEMPLATES = [
  {
    name: 'IEEE Transactions',
    type: 'Journal & Conf',
    desc: 'Double-column format with formal equation and citation guidelines.',
    icon: 'format_list_numbered',
  },
  {
    name: 'Nature Conference',
    type: 'Life & Physical Sciences',
    desc: 'Strict structured abstract, summary paragraph, and methods section.',
    icon: 'biotech',
  },
  {
    name: 'ACM SIGCHI',
    type: 'Computing & HCI',
    desc: 'Extended abstracts, author bio blocks, and accessibility criteria.',
    icon: 'devices',
  },
  {
    name: 'APA 7th Edition',
    type: 'Social Sciences',
    desc: 'Running heads, strict author-date in-text citations, and table styling.',
    icon: 'psychology',
  },
  {
    name: 'NIH Grant Proposal',
    type: 'Funding Application',
    desc: 'Specific aims, significance, innovation, and approach matrices.',
    icon: 'local_hospital',
  },
  {
    name: 'arXiv Preprint',
    type: 'Open Science',
    desc: 'Single-column high-legibility layout for rapid community dissemination.',
    icon: 'public',
  },
];

export const ProjectsLibrary: React.FC = () => {
  const { db, createProject, openProject, deleteProject } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'recent' | 'preprints' | 'grants'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('IEEE Transactions');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createProject(newTitle.trim(), `${selectedTemplate} manuscript`, selectedTemplate);
    setNewTitle('');
    setModalOpen(false);
  };

  const handleCreateFromTemplate = async (templateName: string) => {
    const title = `Untitled ${templateName} Paper`;
    await createProject(title, `Draft initialized from ${templateName} template`, templateName);
  };

  const matchingProjects = db.projects.filter(p => {
    const projectDocs = db.documents.filter(d => d.projectId === p.id);
    const searchText = [p.title, p.description, p.template, ...projectDocs.map(d => d.title)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (searchQuery && !searchText.includes(searchQuery.toLowerCase())) return false;
    if (activeCategory === 'preprints') return p.description.includes('Preprint') || p.template?.includes('arXiv');
    if (activeCategory === 'grants') return p.description.includes('Grant') || p.template?.includes('NIH');
    return true;
  });
  const filteredProjects = activeCategory === 'recent'
    ? [...matchingProjects]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 5)
    : matchingProjects;

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen overflow-y-auto select-none">
      {/* Sticky Sub-Action Utility Bar */}
      <div className="sticky top-0 z-30 bg-surface-container-lowest px-gutter py-space-sm shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-space-sm border-b border-surface-container">
        <div className="flex items-center gap-space-sm flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
            <input 
              className="w-full bg-surface-container-low text-on-surface font-body-ui text-body-ui pl-8 pr-12 py-1 rounded focus:outline-none focus:bg-surface-container-lowest placeholder:text-outline border border-outline-variant" 
              placeholder="Search projects, manuscripts, bibliographies... (⌘K)" 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-label-code text-[10px] bg-surface-container px-1 py-0.5 rounded text-outline-variant">⌘K</kbd>
          </div>

          {/* Filter Category Pills */}
          <div className="hidden xl:flex items-center gap-1 overflow-x-auto py-0.5">
            <button 
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded font-label-md text-xs transition-all ${
                activeCategory === 'all' 
                  ? 'bg-primary text-on-primary shadow-xs' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              All Projects ({db.projects.length})
            </button>
            <button 
              onClick={() => setActiveCategory('recent')}
              className={`px-2.5 py-1 rounded font-label-md text-xs transition-all ${
                activeCategory === 'recent' 
                  ? 'bg-primary text-on-primary shadow-xs' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Recent
            </button>
            <button 
              onClick={() => setActiveCategory('preprints')}
              className={`px-2.5 py-1 rounded font-label-md text-xs transition-all ${
                activeCategory === 'preprints' 
                  ? 'bg-primary text-on-primary shadow-xs' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Preprints
            </button>
            <button 
              onClick={() => setActiveCategory('grants')}
              className={`px-2.5 py-1 rounded font-label-md text-xs transition-all ${
                activeCategory === 'grants' 
                  ? 'bg-primary text-on-primary shadow-xs' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Grants &amp; Proposals
            </button>
          </div>
        </div>

        {/* Right Controls: View Switcher & Primary Action */}
        <div className="flex items-center gap-space-sm shrink-0">
          <div className="flex items-center bg-surface-container-low p-0.5 rounded border border-outline-variant">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`} 
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[16px] block">grid_view</span>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1 rounded transition-colors ${viewMode === 'table' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`} 
              title="Table View"
            >
              <span className="material-symbols-outlined text-[16px] block">table_rows</span>
            </button>
          </div>

          {/* New Project Button & Dropdown */}
          <div className="relative">
            <div className="flex items-center shadow-xs">
              <button 
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary text-on-primary rounded-l font-label-md text-xs hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>New Project</span>
              </button>
              <button 
                onClick={() => setNewMenuOpen(!newMenuOpen)}
                className="px-1.5 py-1 bg-primary-container text-on-primary rounded-r hover:bg-primary transition-colors border-l border-primary-fixed/30"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>

            {newMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface-container-lowest rounded shadow-lg border border-surface-container py-1 z-50 text-xs">
                <button 
                  onClick={() => {
                    setNewMenuOpen(false);
                    setModalOpen(true);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface"
                >
                  <span className="material-symbols-outlined text-primary text-[16px]">post_add</span>
                  <span>Blank Manuscript</span>
                </button>
                <button 
                  onClick={() => {
                    setNewMenuOpen(false);
                    setModalOpen(true);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface"
                >
                  <span className="material-symbols-outlined text-secondary text-[16px]">dashboard_customize</span>
                  <span>New from Template...</span>
                </button>
                <div className="h-px bg-surface-container my-1"></div>
                <button 
                  onClick={() => {
                    setNewMenuOpen(false);
                    const title = prompt('Project title for LaTeX import:');
                    if (title) createProject(title, 'Imported LaTeX repository', 'IEEE Transactions');
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface"
                >
                  <span className="material-symbols-outlined text-outline text-[16px]">upload_file</span>
                  <span>Import LaTeX (.tex / .bib)</span>
                </button>
                <button 
                  onClick={() => {
                    setNewMenuOpen(false);
                    const title = prompt('Project title for Markdown import:');
                    if (title) createProject(title, 'Imported Markdown draft', 'arXiv Preprint');
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface"
                >
                  <span className="material-symbols-outlined text-outline text-[16px]">markdown</span>
                  <span>Import Markdown (.md)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Workspace Content Canvas */}
      <div className="p-gutter lg:p-margin-canvas space-y-space-xl max-w-7xl mx-auto w-full">
        {/* SECTION 1: Academic Document Templates Carousel */}
        <section className="space-y-space-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">auto_stories</span>
              <h2 className="font-headline-sm text-sm font-semibold text-on-surface">Start from Academic Template</h2>
              <span className="font-label-code text-[11px] bg-secondary-fixed text-on-secondary-fixed px-1.5 py-0.5 rounded font-medium">
                {TEMPLATES.length} Pre-Configured
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {TEMPLATES.map((tmpl, i) => (
              <div 
                key={i}
                onClick={() => handleCreateFromTemplate(tmpl.name)}
                className="p-3 bg-surface-container-lowest rounded-lg border border-surface-container hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">
                      {tmpl.icon}
                    </span>
                    <span className="text-[10px] font-label-code text-outline">{tmpl.type}</span>
                  </div>
                  <h4 className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                    {tmpl.name}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1 leading-snug">
                    {tmpl.desc}
                  </p>
                </div>
                <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 pt-1">
                  <span>Use template</span>
                  <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: Project Cards Grid / Table */}
        <section className="space-y-space-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-sm font-semibold text-on-surface">Your Research Projects &amp; Manuscripts</h2>
            <span className="text-xs text-outline">{filteredProjects.length} projects stored locally</span>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const doc = db.documents.find(d => d.projectId === project.id);
                const words = doc ? doc.wordCount : 0;
                return (
                  <div 
                    key={project.id}
                    onClick={() => openProject(project.id)}
                    className="p-4 bg-surface-container-lowest rounded-lg border border-surface-container hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-primary font-label-code text-[11px] font-medium">
                          {project.template || 'IEEE Transactions'}
                        </span>
                        <span className="text-[10px] text-outline font-label-code">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {project.title}
                      </h3>

                      <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
                        {project.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-container text-[11px] text-outline">
                      <span>{words.toLocaleString()} words</span>
                      <div className="flex items-center gap-2">
                        {db.projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete project "${project.title}"?`)) {
                                deleteProject(project.id);
                              }
                            }}
                            className="p-1 hover:text-error rounded text-outline hover:bg-surface-container"
                            title="Delete project"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                        <span className="text-primary font-medium flex items-center gap-0.5">
                          <span>Open</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-lg border border-surface-container overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-surface-container">
                  <tr>
                    <th className="p-3 font-medium">Project Title</th>
                    <th className="p-3 font-medium">Template</th>
                    <th className="p-3 font-medium">Words</th>
                    <th className="p-3 font-medium">Last Modified</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {filteredProjects.map((p) => {
                    const doc = db.documents.find(d => d.projectId === p.id);
                    return (
                      <tr 
                        key={p.id}
                        onClick={() => openProject(p.id)}
                        className="hover:bg-surface-container cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-medium text-on-surface">{p.title}</td>
                        <td className="p-3 text-outline">{p.template || 'IEEE Transactions'}</td>
                        <td className="p-3 text-outline">{doc ? doc.wordCount.toLocaleString() : 0}</td>
                        <td className="p-3 text-outline">{new Date(p.updatedAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {db.projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete project "${p.title}"?`)) {
                                    deleteProject(p.id);
                                  }
                                }}
                                className="p-1 text-outline hover:text-error"
                                title="Delete project"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            )}
                            <span className="text-primary font-medium">Open →</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* New Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-surface-container-lowest rounded-lg shadow-xl max-w-md w-full p-5 border border-surface-container space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-on-surface">Create New Research Project</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-outline hover:text-on-surface text-sm">✕</button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-on-surface">Project Title</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Dual-Channel Verification in Multimodal Reasoning"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-xs p-2 border border-outline-variant rounded bg-surface text-on-surface focus:outline-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-on-surface">Target Academic Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full text-xs p-2 border border-outline-variant rounded bg-surface text-on-surface focus:outline-primary"
              >
                {TEMPLATES.map((t, idx) => (
                  <option key={idx} value={t.name}>{t.name} ({t.type})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setModalOpen(false)} 
                className="px-3 py-1.5 rounded text-xs text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-primary text-on-primary text-xs rounded font-medium shadow-xs"
              >
                Create Manuscript
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
