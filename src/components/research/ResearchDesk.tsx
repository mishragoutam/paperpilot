import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { aiService } from '../../services/ai';
import type { Source } from '../../services/db';

export const ResearchDesk: React.FC = () => {
  const { db, addSources, activeProjectId, insertCitation, markSourceCited } = useAppStore();
  const geminiKey = db.settings?.geminiKey || '';

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cited' | 'saved' | 'pdfs'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [bibtexSource, setBibtexSource] = useState<Source | null>(null);

  const activeProject = db.projects.find(p => p.id === activeProjectId);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const results = await aiService.searchScholarlyLiterature(
        query.trim(), 
        geminiKey || undefined, 
        db.settings?.activeModel
      );
      if (results && results.length > 0) {
        const fullSources: Source[] = results.map((r, i) => ({
          id: r.id || `src-${Date.now()}-${i}`,
          projectId: activeProjectId || '',
          title: r.title || 'Untitled Research',
          authors: r.authors || 'Unknown Authors',
          publication: r.publication || 'Academic Repository',
          publishedAt: r.publishedAt || String(new Date().getFullYear()),
          url: r.url || (r.doi ? `https://doi.org/${r.doi}` : ''),
          doi: r.doi || '',
          snippet: r.snippet || '',
          abstract: r.abstract || '',
          accessedAt: new Date().toISOString(),
          notes: '',
          semanticMatch: r.semanticMatch,
          tag: r.tag || 'Peer-Reviewed'
        }));
        await addSources(fullSources);
        setQuery('');
      } else {
        alert('No academic papers found for this query. Try a broader scholarly topic or keyword.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to search academic literature.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSyncFeeds = async () => {
    setIsRefreshing(true);
    try {
      const topic = activeProject?.title || 'Neuro-Symbolic AI & Fact Verification';
      const results = await aiService.searchScholarlyLiterature(
        topic,
        geminiKey || undefined,
        db.settings?.activeModel
      );
      if (results && results.length > 0) {
        const mapped: Source[] = results.map((r, i) => ({
          id: `sync-${Date.now()}-${i}`,
          projectId: activeProjectId || '',
          title: r.title || 'Untitled',
          authors: r.authors || 'Authors',
          publication: r.publication || 'Repository',
          publishedAt: r.publishedAt || '2024',
          url: r.url || (r.doi ? `https://doi.org/${r.doi}` : ''),
          doi: r.doi || '',
          snippet: r.snippet || '',
          abstract: r.abstract || '',
          accessedAt: new Date().toISOString(),
          notes: '',
          semanticMatch: '95%',
          tag: 'Open Access'
        }));
        await addSources(mapped);
      } else {
        alert('No new academic papers were found for this project.');
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Could not refresh academic sources.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleCite = (source: Source, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanAuthor = source.authors.split(' ')[0] || 'Author';
    const citationTag = `[${cleanAuthor} et al., ${source.publishedAt}]`;
    insertCitation(citationTag);
    void markSourceCited(source.id).catch((error: unknown) => {
      console.error('Could not mark source as cited:', error);
    });
  };

  const filteredSources = db.sources.filter(s => {
    if (activeFilter === 'cited') return s.notes?.includes('[cited]');
    if (activeFilter === 'saved') return s.projectId === activeProjectId;
    if (activeFilter === 'pdfs') return Boolean(s.url || s.doi);
    return true;
  });

  return (
    <aside className="w-[280px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[1px_0_12px_rgba(19,27,46,0.03)] z-20 border-r border-surface-container select-none">
      {/* Desk Header */}
      <div className="px-space-md py-space-sm bg-surface-container-low/70 flex flex-col gap-1.5 shrink-0 border-b border-surface-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[17px] text-primary">menu_book</span>
            <span className="font-label-md text-label-md font-semibold tracking-tight text-on-surface">Research Desk</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleSyncFeeds}
              className={`w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              title="Sync Feeds"
            >
              <span className="material-symbols-outlined text-[15px]">sync</span>
            </button>
            <button 
              onClick={() => setActiveFilter(activeFilter === 'all' ? 'cited' : 'all')}
              className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors" 
              title="Filter Settings"
            >
              <span className="material-symbols-outlined text-[15px]">filter_list</span>
            </button>
          </div>
        </div>

        {/* Topic Pill */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-tertiary font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse shrink-0"></span>
          <span className="truncate">Topic: {activeProject ? activeProject.title : 'Neuro-Symbolic AI & Fact Verification'}</span>
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className="p-space-xs shrink-0 border-b border-surface-container">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-2 text-outline text-[14px]">search</span>
          <input 
            className="w-full pl-6 pr-6 py-1 text-label-sm font-label-sm rounded bg-surface-container-low text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:outline-none transition-all" 
            placeholder="Search arXiv, CrossRef, Semantic..." 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <span className="absolute right-2 font-label-code text-[10px] text-outline">/</span>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-space-xs py-1.5 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none border-b border-surface-container">
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] whitespace-nowrap transition-colors ${
            activeFilter === 'all' 
              ? 'bg-primary text-on-primary shadow-sm' 
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All ({db.sources.length})
        </button>
        <button 
          onClick={() => setActiveFilter('cited')}
          className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] whitespace-nowrap transition-colors ${
            activeFilter === 'cited' 
              ? 'bg-primary text-on-primary shadow-sm' 
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Cited ({db.sources.filter(s => s.notes?.includes('[cited]')).length})
        </button>
        <button 
          onClick={() => setActiveFilter('saved')}
          className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] whitespace-nowrap transition-colors ${
            activeFilter === 'saved' 
              ? 'bg-primary text-on-primary shadow-sm' 
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Saved ({db.sources.filter(s => s.projectId === activeProjectId).length})
        </button>
        <button 
          onClick={() => setActiveFilter('pdfs')}
          className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] whitespace-nowrap transition-colors ${
            activeFilter === 'pdfs' 
              ? 'bg-primary text-on-primary shadow-sm' 
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          PDFs ({db.sources.filter(s => s.doi || s.url).length})
        </button>
      </div>

      {/* Source Items Feed */}
      <div className="flex-1 overflow-y-auto px-space-xs py-1 space-y-1.5">
        {isSearching && (
          <div className="text-center py-6 text-outline text-xs flex flex-col items-center gap-1.5">
            <span className="material-symbols-outlined animate-spin text-[18px] text-primary">progress_activity</span>
            <span>Querying academic repositories...</span>
          </div>
        )}

        {!isSearching && filteredSources.map((source, idx) => (
          <article 
            key={source.id} 
            onClick={() => setSelectedSource(source)}
            className="p-2 rounded bg-surface-container-low hover:bg-surface-container transition-colors group cursor-pointer shadow-sm flex flex-col gap-1 border border-surface-container"
          >
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-body-ui-medium text-[12px] leading-tight text-on-surface line-clamp-2 group-hover:text-primary transition-colors select-text">
                {source.title}
              </h4>
              {source.semanticMatch && (
                <span className="shrink-0 font-label-code text-[10px] text-tertiary bg-tertiary-fixed px-1 rounded font-medium" title="Relevance estimate">
                  {source.semanticMatch} match
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px] font-label-sm text-on-surface-variant flex-wrap">
              <span>{source.authors}</span>
              <span>•</span>
              <span>{source.publishedAt}</span>
              {source.publication && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-secondary">{source.publication}</span>
                </>
              )}
            </div>

            <p className="font-body-ui text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed bg-surface-container-lowest/70 p-1.5 rounded select-text">
              {source.snippet || source.abstract}
            </p>

            <div className="flex items-center justify-between pt-0.5 mt-0.5">
              <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-primary font-label-sm text-[10px] font-medium">
                {source.tag || 'Peer-Reviewed'}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => handleCite(source, e)}
                  className="px-1.5 py-0.5 rounded bg-primary-fixed hover:bg-primary text-on-primary-fixed hover:text-on-primary font-label-sm text-[10px] transition-colors flex items-center gap-0.5" 
                  title="Cite into active cursor"
                >
                  <span className="material-symbols-outlined text-[11px]">format_quote</span>
                  <span>Cite +</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSource(source);
                  }}
                  className="p-0.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors" 
                  title="Read Abstract & Details"
                >
                  <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setBibtexSource(source);
                  }}
                  className="p-0.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors" 
                  title="Metadata & BibTeX"
                >
                  <span className="material-symbols-outlined text-[13px]">more_vert</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Collapsible Claims & Evidence Matrix Drawer */}
      <div className="bg-surface-container-low p-space-xs shrink-0 flex flex-col gap-1.5 border-t border-surface-container">
        <button 
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="w-full flex items-center justify-between px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">balance</span>
            <span className="font-label-sm text-label-sm font-semibold">Claims &amp; Evidence Matrix</span>
          </div>
          <span className={`material-symbols-outlined text-[14px] text-outline transition-transform ${drawerOpen ? '' : 'rotate-180'}`}>
            expand_less
          </span>
        </button>

        {drawerOpen && (
          <div className="p-2 rounded bg-surface-container-lowest shadow-sm flex flex-col gap-1 border border-surface-container-high">
            <div className="flex items-center justify-between font-label-code text-[10px] text-outline">
              <span>Chen (2024) vs Valdivia (2023)</span>
              <span className="text-tertiary font-semibold">Diff +120ms</span>
            </div>
            <p className="font-body-ui text-[11px] text-on-surface-variant leading-snug">
              <strong className="text-on-surface font-medium">Chen (2024)</strong> asserts 41% error drop vs <strong className="text-on-surface font-medium">Valdivia (2023)</strong> benchmark showing Horn-clause latency overhead of 120ms.
            </p>
            <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden mt-0.5">
              <div className="bg-primary h-full w-[65%] rounded-full"></div>
            </div>
          </div>
        )}
      </div>

      {/* Source Abstract Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-lg shadow-xl max-w-lg w-full p-5 border border-surface-container space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm text-on-surface">{selectedSource.title}</h3>
              <button onClick={() => setSelectedSource(null)} className="text-outline hover:text-on-surface text-sm">✕</button>
            </div>
            <p className="text-xs text-outline">{selectedSource.authors} ({selectedSource.publishedAt}) — {selectedSource.publication}</p>
            {selectedSource.doi && (
              <p className="text-[11px] font-label-code text-primary">DOI: {selectedSource.doi}</p>
            )}
            <div className="p-3 bg-surface-container-low rounded text-xs text-on-surface leading-relaxed max-h-60 overflow-y-auto">
              {selectedSource.abstract || selectedSource.snippet}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={(e) => {
                  handleCite(selectedSource, e);
                  setSelectedSource(null);
                }} 
                className="px-3 py-1 bg-primary text-on-primary text-xs rounded font-medium"
              >
                Insert Citation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BibTeX Modal */}
      {bibtexSource && (() => {
        const firstAuthor = (bibtexSource.authors || 'author').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'author';
        const year = bibtexSource.publishedAt || '2024';
        const bibtexString = `@article{${firstAuthor}${year},
  title = {${bibtexSource.title}},
  author = {${bibtexSource.authors}},
  journal = {${bibtexSource.publication || 'Preprint'}},
  year = {${year}},
  doi = {${bibtexSource.doi || '10.xxxx/xxxx'}}
}`;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-lg shadow-xl max-w-md w-full p-4 border border-surface-container space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">format_quote</span>
                  <h3 className="font-semibold text-xs text-on-surface">BibTeX Record</h3>
                </div>
                <button onClick={() => setBibtexSource(null)} className="text-outline hover:text-on-surface text-sm">✕</button>
              </div>
              <pre className="p-3 bg-surface-container text-[11px] font-label-code rounded overflow-x-auto text-on-surface select-text leading-relaxed">
{bibtexString}
              </pre>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-outline font-label-code">{firstAuthor}{year}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBibtexSource(null)}
                    className="px-2.5 py-1 text-xs text-outline hover:text-on-surface"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(bibtexString);
                      alert('BibTeX citation copied to clipboard!');
                      setBibtexSource(null);
                    }}
                    className="px-3 py-1 bg-primary text-on-primary text-xs rounded font-medium flex items-center gap-1 shadow-xs hover:bg-primary-container"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>Copy BibTeX</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
};
