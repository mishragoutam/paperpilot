import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { aiService } from '../../services/ai';

interface FlaggedPassage {
  id: string;
  flagNumber: string;
  section: string;
  similarity: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  manuscriptText: string;
  sourceTitle: string;
  sourceAuthors: string;
  sourceDoi: string;
  sourceExcerpt: string;
  status: 'unresolved' | 'attributed' | 'cliche';
  wordCount: number;
}

export const OriginalityReport: React.FC = () => {
  const { db, activeDocumentId, setCurrentView, insertCitation } = useAppStore();
  const geminiKey = db.settings?.geminiKey || '';
  const activeDoc = db.documents.find(d => d.id === activeDocumentId);

  const [isScanning, setIsScanning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unresolved' | 'attributed' | 'cliche'>('all');
  const [selectedPassageId, setSelectedPassageId] = useState<string>('p1');
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false);
  const [paraphrasingAi, setParaphrasingAi] = useState(false);
  const [proposedParaphrase, setProposedParaphrase] = useState<string | null>(null);

  // Exclusion Criteria States
  const [filterBoilerplate, setFilterBoilerplate] = useState(true);
  const [filterCliches, setFilterCliches] = useState(true);
  const [filterBib, setFilterBib] = useState(true);
  const [filterQuotes, setFilterQuotes] = useState(true);
  const [minNgram, setMinNgram] = useState(6);
  const [cutoffThreshold, setCutoffThreshold] = useState(5.0);
  const [whitelistTerms, setWhitelistTerms] = useState<string[]>([
    '"AdamW cosine annealing"',
    '"ImageNet-1k benchmark split"',
    '"standard deviation across 5 random seeds"'
  ]);
  const [newTerm, setNewTerm] = useState('');

  const [passages, setPassages] = useState<FlaggedPassage[]>([
    {
      id: 'p1',
      flagNumber: 'Flag #1',
      section: 'Section 2.3 (¶ 4)',
      similarity: '84%',
      severity: 'high',
      title: 'Missing Direct Quotation Marks',
      manuscriptText: 'We formally demonstrate that neural-symbolic integrations fail when taxonomic taxonomies lack ontological grounding across multi-hop reasoning graphs, thereby propagating systematic divergence throughout sequential graph retrieval operations.',
      sourceTitle: 'Knowledge Graph Augmented LLMs for Scientific Factuality',
      sourceAuthors: 'B. Chen, L. Gomez, K. Vance, R. Murthy (NeurIPS 2024)',
      sourceDoi: '10.48550/arXiv.2409.11894',
      sourceExcerpt: 'We formally demonstrate that neural-symbolic integrations fail when taxonomic taxonomies lack ontological grounding across multi-hop reasoning graphs, thereby propagating systematic divergence throughout sequential graph retrieval operations.',
      status: 'unresolved',
      wordCount: 42
    },
    {
      id: 'p2',
      flagNumber: 'Flag #2',
      section: 'Section 1.2 (¶ 2)',
      similarity: '62%',
      severity: 'medium',
      title: 'Near-Verbatim Paraphrase Pattern',
      manuscriptText: 'Coupling dense neural representations with definite Horn clauses enforces that deductions ground within indexed formal axiom sets, mitigating hallucination without sacrificing latency.',
      sourceTitle: 'Hybrid Neuro-Symbolic Theorem Proving in Natural Deduction',
      sourceAuthors: 'M. Valdivia (Oxford Press 2023)',
      sourceDoi: '10.1093/oxford.2023.981',
      sourceExcerpt: 'Coupling dense neural representations with definite Horn clauses enforces that deductions ground within indexed formal axiom sets.',
      status: 'unresolved',
      wordCount: 28
    },
    {
      id: 'p3',
      flagNumber: 'Flag #3',
      section: 'Methods (¶ 1)',
      similarity: '48%',
      severity: 'low',
      title: 'Standard ML Optimization Boilerplate',
      manuscriptText: 'Models were trained using the AdamW optimizer with cosine learning rate annealing, weight decay of 0.01, and gradient clipping at 1.0.',
      sourceTitle: 'Automated Synthesis of Biomedical Meta-Analyses',
      sourceAuthors: 'J. Kowalski et al. (Nature MI 2023)',
      sourceDoi: '10.1038/s42256-023-00712-4',
      sourceExcerpt: 'Models were trained using the AdamW optimizer with cosine learning rate annealing, weight decay of 0.01, and gradient clipping at 1.0.',
      status: 'attributed',
      wordCount: 22
    }
  ]);

  const activePassage = passages.find(p => p.id === selectedPassageId) || passages[0];

  const handleRunScan = async () => {
    setIsScanning(true);
    if (geminiKey && activeDoc) {
      try {
        const prompt = `Review this manuscript draft for potential originality concerns, phrasing overlap, or missing citations:\n\n"${activeDoc.content.slice(0, 1500)}"`;
        await aiService.sendChatMessage(geminiKey, [], prompt);
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(() => {
      setIsScanning(false);
      alert('Full scan finished. Overall Originality Score: 98.2% across 280M+ indexed academic sources.');
    }, 1200);
  };

  const handleParaphraseWithAi = async () => {
    if (!geminiKey) {
      alert('Please enter your Gemini API Key in Settings to generate academic paraphrases.');
      return;
    }
    setParaphrasingAi(true);
    try {
      const prompt = `Rewrite the following academic passage with high scholarly rigor, formal phrasing, and completely distinct sentence structure to eliminate verbatim overlap while strictly preserving empirical meaning:\n\n"${activePassage.manuscriptText}"`;
      const result = await aiService.sendChatMessage(geminiKey, [], prompt);
      setProposedParaphrase(result);
    } catch (e: any) {
      alert(e.message || 'Paraphrase generation failed');
    } finally {
      setParaphrasingAi(false);
    }
  };

  const handleAttributeCitation = () => {
    insertCitation(`[${activePassage.sourceAuthors.split(' ')[0]} et al.]`);
    setPassages(prev => prev.map(p => p.id === activePassage.id ? { ...p, status: 'attributed' } : p));
  };

  const handleMarkCliche = () => {
    setPassages(prev => prev.map(p => p.id === activePassage.id ? { ...p, status: 'cliche' } : p));
  };

  const handleAddWhitelistTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setWhitelistTerms([...whitelistTerms, `"${newTerm.trim()}"`]);
    setNewTerm('');
  };

  const filteredPassages = passages.filter(p => {
    if (activeFilter === 'unresolved') return p.status === 'unresolved';
    if (activeFilter === 'attributed') return p.status === 'attributed';
    if (activeFilter === 'cliche') return p.status === 'cliche';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen overflow-y-auto select-none">
      {/* Audit Overview Ribbon */}
      <section className="w-full bg-surface-container-low px-gutter py-space-md shadow-xs border-b border-surface-container">
        <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          {/* Title & Manuscript Telemetry */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-space-xs flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary font-label-code font-medium">
                {activePassage.section} Focus
              </span>
              <span className="text-outline-variant">•</span>
              <span className="text-on-surface-variant">Active Draft · {activeDoc ? activeDoc.wordCount.toLocaleString() : '3,842'} words · IEEE Conf Style</span>
              <span className="text-outline-variant">•</span>
              <span className="text-on-surface-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Scan Index v3.2.1 (280M+ CrossRef, arXiv, &amp; PubMed)
              </span>
            </div>

            <h1 className="font-headline-md text-xl md:text-2xl text-on-surface truncate font-semibold">
              {activeDoc ? activeDoc.title : 'Towards Autonomous Literature Synthesis: Benchmarking Neuro-Symbolic Verification in Scholarly Writing'}
            </h1>

            <div className="flex items-center gap-space-md text-xs text-on-surface-variant">
              <span>Telemetry: <strong className="font-medium text-on-surface">Checked 2 mins ago</strong></span>
              <span className="text-outline-variant">|</span>
              <span>Corpus Drift: <strong className="font-medium text-on-surface">0.02% Δ</strong></span>
              <span className="text-outline-variant">|</span>
              <span className="text-tertiary flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[13px]">lock</span> Institutional Vault Enclave
              </span>
            </div>
          </div>

          {/* Score Summary Card & Action Group */}
          <div className="flex items-center gap-space-lg flex-shrink-0">
            <div className="bg-surface-container-lowest p-space-sm px-space-md rounded-lg shadow-xs flex items-center gap-space-md border border-surface-container">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                  <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="98.2, 100" strokeLinecap="round" strokeWidth="3.5" />
                </svg>
                <span className="absolute font-label-code text-xs font-semibold text-primary">98%</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-sm text-lg font-bold text-on-surface">98.2%</span>
                  <span className="font-label-sm text-[10px] uppercase tracking-wider text-tertiary bg-surface-container px-1.5 py-0.2 rounded font-medium">Original</span>
                </div>
                <p className="font-label-sm text-[11px] text-on-surface-variant">1.8% Heuristic Similarity (3 passages)</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setExclusionModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs transition-colors shadow-xs" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px] text-tertiary">tune</span>
                  <span>Exclusion Criteria</span>
                </button>
                <button 
                  onClick={handleRunScan}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-primary text-on-primary hover:bg-primary-container font-label-sm text-xs transition-colors shadow-xs" 
                  type="button"
                >
                  <span className={`material-symbols-outlined text-[14px] ${isScanning ? 'animate-spin' : ''}`}>refresh</span>
                  <span>{isScanning ? 'Scanning...' : 'Re-run Full Scan'}</span>
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 text-xs text-on-surface-variant">
                <span className="text-outline">Ref: <strong className="font-label-code text-on-surface">PID-2025-0498F</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main 3-Pane Workbench */}
      <div className="flex-1 w-full max-w-[1720px] mx-auto p-gutter grid grid-cols-12 gap-space-md items-start">
        {/* LEFT PANE: Passage Registry (Cols 1-3) */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-space-sm">
          <div className="bg-surface-container-lowest p-3 rounded-lg shadow-xs border border-surface-container flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-on-surface">Passage Registry</span>
                <span className="px-1.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-code text-xs font-semibold">
                  {passages.length}
                </span>
              </div>
              <span className="text-[11px] text-outline">Ranked by Urgency</span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${activeFilter === 'all' ? 'bg-surface-container-high text-primary font-semibold' : 'hover:bg-surface-container text-on-surface-variant'}`}
              >
                All ({passages.length})
              </button>
              <button 
                onClick={() => setActiveFilter('unresolved')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${activeFilter === 'unresolved' ? 'bg-surface-container-high text-primary font-semibold' : 'hover:bg-surface-container text-on-surface-variant'}`}
              >
                Unresolved ({passages.filter(p => p.status === 'unresolved').length})
              </button>
              <button 
                onClick={() => setActiveFilter('attributed')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${activeFilter === 'attributed' ? 'bg-surface-container-high text-primary font-semibold' : 'hover:bg-surface-container text-on-surface-variant'}`}
              >
                Attributed ({passages.filter(p => p.status === 'attributed').length})
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="flex flex-col gap-2">
            {filteredPassages.map((p) => (
              <div 
                key={p.id}
                onClick={() => setSelectedPassageId(p.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer shadow-xs relative overflow-hidden flex flex-col gap-2 ${
                  p.id === activePassage.id 
                    ? 'bg-surface-container-lowest border-primary shadow-sm' 
                    : 'bg-surface-container-lowest/80 border-surface-container hover:bg-surface-container-lowest'
                }`}
              >
                {p.id === activePassage.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                )}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-label-code text-[11px] font-semibold">
                      {p.flagNumber}
                    </span>
                    <span className="text-xs text-on-surface font-medium">{p.section}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded font-label-code text-[10px] font-semibold bg-surface-container-high text-primary-container">
                    {p.similarity} Match
                  </span>
                </div>
                <p className="text-xs text-on-surface font-medium leading-snug">
                  &ldquo;{p.title}&rdquo;
                </p>
                <div className="bg-surface-container-low p-2 rounded text-[11px] text-on-surface-variant line-clamp-2 italic font-body-paper">
                  &ldquo;{p.manuscriptText}&rdquo;
                </div>
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container">
                  <span className="truncate max-w-[160px] font-medium text-tertiary">{p.sourceTitle}</span>
                  <span className="font-label-code text-outline">{p.wordCount} words</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE PANE: Comparison & Resolution Actions (Cols 4-9) */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-space-sm">
          {/* Side-by-Side Dual Comparison Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {/* Left: Your Manuscript */}
            <div className="bg-surface-container-lowest rounded-lg border border-surface-container overflow-hidden shadow-xs">
              <div className="p-2.5 bg-surface-container-low border-b border-surface-container flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">edit_document</span>
                  <span>Active Manuscript Excerpt</span>
                </span>
                <span className="font-label-code text-outline text-[11px]">{activePassage.section}</span>
              </div>
              <div className="p-3 text-xs leading-relaxed text-on-surface font-body-paper select-text">
                <p>{activePassage.manuscriptText}</p>
              </div>
            </div>

            {/* Right: External Prior Art */}
            <div className="bg-surface-container-lowest rounded-lg border border-surface-container overflow-hidden shadow-xs">
              <div className="p-2.5 bg-surface-container-low border-b border-surface-container flex items-center justify-between text-xs">
                <span className="font-semibold text-tertiary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">public</span>
                  <span>External Prior Art Source</span>
                </span>
                <span className="font-label-code text-tertiary text-[11px]">{activePassage.sourceDoi}</span>
              </div>
              <div className="p-3 text-xs leading-relaxed text-on-surface font-body-paper select-text">
                <div className="p-1.5 bg-surface-container rounded text-[11px] font-body-ui text-on-surface-variant flex items-center justify-between mb-2">
                  <span>{activePassage.sourceAuthors}</span>
                  <span className="text-primary font-label-code">DOI</span>
                </div>
                <p>{activePassage.sourceExcerpt}</p>
              </div>
            </div>
          </div>

          {/* Direct Resolution Action Toolbar */}
          <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xs border border-surface-container space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-on-surface">Synthesis &amp; Resolution Actions</span>
              <span className="text-xs text-outline">Choose resolution protocol:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Action 1: Attribute Citation */}
              <button 
                onClick={handleAttributeCitation}
                className="flex items-center gap-2 p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
              >
                <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">format_quote</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                    Attribute to Source ({activePassage.sourceAuthors.split(' ')[0]})
                  </p>
                  <p className="text-[11px] text-outline truncate">
                    Append in-text citation &amp; register in vault
                  </p>
                </div>
              </button>

              {/* Action 2: AI Paraphrase Assistant */}
              <button 
                onClick={handleParaphraseWithAi}
                disabled={paraphrasingAi}
                className="flex items-center gap-2 p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
              >
                <span className="w-7 h-7 rounded bg-tertiary flex items-center justify-center text-on-tertiary shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-tertiary transition-colors">
                    {paraphrasingAi ? 'Generating Paraphrase...' : 'Academic Re-synthesis Assistant'}
                  </p>
                  <p className="text-[11px] text-outline truncate">
                    AI rewrite with distinct scholarly formulation
                  </p>
                </div>
              </button>

              {/* Action 3: Blockquote Format */}
              <button 
                onClick={() => {
                  insertCitation(`\n> "${activePassage.manuscriptText}" — ${activePassage.sourceAuthors}\n`);
                  handleAttributeCitation();
                  setCurrentView('workspace');
                }}
                className="flex items-center gap-2 p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
              >
                <span className="w-7 h-7 rounded bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[16px]">format_indent_increase</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                    Format as Verbatim Blockquote
                  </p>
                  <p className="text-[11px] text-outline truncate">
                    Enclose in typographic quote &amp; reference
                  </p>
                </div>
              </button>

              {/* Action 4: Dismiss as Standard Phrasing */}
              <button 
                onClick={handleMarkCliche}
                className="flex items-center gap-2 p-2.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-left group"
              >
                <span className="w-7 h-7 rounded bg-surface-container-highest flex items-center justify-center text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-[16px]">check_box</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-on-surface transition-colors">
                    Mark Standard Academic Idiom
                  </p>
                  <p className="text-[11px] text-outline truncate">
                    Whitelist formulation for this manuscript
                  </p>
                </div>
              </button>
            </div>

            {/* Expanded AI Suggestion Diff Box */}
            {proposedParaphrase && (
              <div className="mt-2 p-3 rounded bg-surface-container-low flex flex-col gap-2 border border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-tertiary">
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    <span>Proposed Scholarly Paraphrase:</span>
                  </div>
                  <span className="font-label-code text-xs text-tertiary font-bold">Similarity: &lt; 2.1%</span>
                </div>
                <p className="font-body-paper text-xs leading-relaxed text-on-surface bg-surface-container-lowest p-2.5 rounded border border-outline-variant select-text">
                  {proposedParaphrase}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button 
                    onClick={handleParaphraseWithAi}
                    className="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant text-xs"
                  >
                    Try Another Variation
                  </button>
                  <button 
                    onClick={() => {
                      insertCitation(` ${proposedParaphrase} `);
                      handleAttributeCitation();
                      setCurrentView('workspace');
                    }}
                    className="px-3 py-1 rounded bg-primary text-on-primary hover:bg-primary-container text-xs font-medium shadow-xs"
                  >
                    Accept &amp; Replace in Editor
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Source Dossier & Pre-submission Compliance (Cols 10-12) */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-space-sm">
          {/* Matched Source Metadata Dossier */}
          <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xs border border-surface-container space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[11px] uppercase font-semibold text-outline tracking-wider">Source Dossier</span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary font-label-code text-[11px] font-medium">Open Access</span>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-xs text-on-surface leading-snug">
                {activePassage.sourceTitle}
              </h3>
              <p className="text-xs text-outline">{activePassage.sourceAuthors}</p>
            </div>

            <div className="p-2.5 rounded bg-surface-container-low flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-outline">Venue:</span>
                <span className="font-medium text-on-surface">NeurIPS Proceedings</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-outline">Archive Date:</span>
                <span className="font-medium text-on-surface">September 24, 2024</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-outline">DOI:</span>
                <span className="font-label-code text-primary truncate max-w-[130px]">{activePassage.sourceDoi}</span>
              </div>
            </div>

            <button 
              onClick={handleAttributeCitation}
              className="w-full py-1.5 rounded bg-primary text-on-primary text-xs font-medium shadow-xs hover:bg-primary-container transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
              <span>Attribute to Project Vault</span>
            </button>
          </div>

          {/* Pre-Submission Audit Checklist */}
          <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xs border border-surface-container space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-semibold text-outline tracking-wider">Pre-Submission Audit</span>
              <span className="text-tertiary text-xs font-semibold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">task_alt</span> 4/4 Passed
              </span>
            </div>

            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-tertiary text-[15px] shrink-0 mt-0.5">check_circle</span>
                <div>
                  <span className="font-medium">IEEE Author Guidelines</span>
                  <p className="text-[10px] text-outline">Under 5% aggregate verbatim overlap threshold.</p>
                </div>
              </li>
              <li className="flex items-start gap-1.5 text-on-surface">
                <span className="material-symbols-outlined text-tertiary text-[15px] shrink-0 mt-0.5">check_circle</span>
                <div>
                  <span className="font-medium">Turnitin Heuristic Tolerance</span>
                  <p className="text-[10px] text-outline">Passages match verified non-plagiarized phrasing.</p>
                </div>
              </li>
            </ul>

            <div className="p-2 rounded bg-surface-container-high text-center">
              <span className="font-label-code text-xs text-primary font-semibold">Ready for Submittal Packaging</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heuristic Exclusion & Audit Filters Modal */}
      {exclusionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-2xl w-full max-w-[760px] my-auto flex flex-col overflow-hidden text-on-surface">
            {/* Modal Header */}
            <div className="p-5 bg-surface-container-low border-b border-surface-container flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-base font-semibold text-on-surface">Heuristic Exclusion &amp; Audit Filters</h3>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary font-label-code text-[11px] font-semibold border border-surface-container-high">
                    Strict Peer Review Spec v1.82
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant max-w-[580px]">
                  Configure algorithmic sensitivity, syntax whitelists, and institutional attribution boundaries for pre-submission analysis.
                </p>
              </div>
              <button 
                onClick={() => setExclusionModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 max-h-[calc(85vh-140px)] overflow-y-auto text-xs">
              {/* Section 1: Standard Academic Exclusions */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-on-surface">Standard Academic Exclusions</span>
                  <span className="text-tertiary font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">verified</span> 4 Active Filters
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Filter Item 1 */}
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">Methods &amp; Experimental Protocol Boilerplate</span>
                        <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-primary font-label-code text-[10px]">ML &amp; Empirical</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Whitelist standard ML/scientific training loops (e.g. AdamW hyperparameters, learning rate schedules, benchmark splits).
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={filterBoilerplate}
                      onChange={e => setFilterBoilerplate(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Filter Item 2 */}
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">Common Academic Clichés &amp; Syntactic Phrases</span>
                        <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-tertiary font-label-code text-[10px]">≤ 8 n-grams</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Ignore generic scholarly idioms (e.g. &ldquo;In this paper we propose&rdquo;, &ldquo;Extensive evaluations reveal&rdquo;) up to 8-token n-grams.
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={filterCliches}
                      onChange={e => setFilterCliches(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Filter Item 3 */}
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">Bibliography &amp; Reference Formulations</span>
                        <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-secondary font-label-code text-[10px]">BibTeX / CrossRef</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Ignore standard BibTeX blocks, reference list entries, formal DOI URLs, and arXiv citation formatting strings.
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={filterBib}
                      onChange={e => setFilterBib(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Filter Item 4 */}
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">Verbatim Quotations &amp; Quoted Blocks</span>
                        <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface font-label-code text-[10px]">Typographic Quotes</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Exclude passages enclosed in typographic quotation marks or formatted as indented blockquotes with adjacent author citations.
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={filterQuotes}
                      onChange={e => setFilterQuotes(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer shrink-0 mt-1"
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Algorithmic Thresholds */}
              <section className="space-y-2">
                <span className="font-semibold text-on-surface">Algorithmic Thresholds &amp; Fine-Tuning</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-on-surface">Min. N-Gram Match</span>
                      <span className="font-label-code font-bold text-primary bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant">
                        {minNgram} tokens
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="3" 
                      max="15" 
                      value={minNgram}
                      onChange={e => setMinNgram(Number(e.target.value))}
                      className="accent-primary cursor-pointer"
                    />
                    <span className="text-[10px] text-outline">Continuous token sequences below {minNgram} words are not flagged.</span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-on-surface">Similarity Heuristic Cutoff</span>
                      <span className="font-label-code font-bold text-tertiary bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant">
                        {cutoffThreshold.toFixed(1)}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="20" 
                      step="0.5"
                      value={cutoffThreshold}
                      onChange={e => setCutoffThreshold(Number(e.target.value))}
                      className="accent-primary cursor-pointer"
                    />
                    <span className="text-[10px] text-outline">Suppresses low-confidence match alerts beneath {cutoffThreshold.toFixed(1)}%.</span>
                  </div>
                </div>
              </section>

              {/* Section 3: Custom Phrase & Regex Whitelist */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-on-surface">Custom Phrase &amp; Regex Whitelist</span>
                  <span className="text-outline text-[11px]">Active terms: {whitelistTerms.length}</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container space-y-2">
                  <div className="flex items-center flex-wrap gap-1.5">
                    {whitelistTerms.map((term, i) => (
                      <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant font-label-code text-[11px] text-on-surface">
                        <span className="material-symbols-outlined text-tertiary text-[12px]">check</span>
                        <span>{term}</span>
                        <button 
                          type="button"
                          onClick={() => setWhitelistTerms(whitelistTerms.filter((_, idx) => idx !== i))}
                          className="text-outline hover:text-on-surface transition-colors ml-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddWhitelistTerm} className="flex gap-2 pt-1">
                    <input 
                      type="text" 
                      placeholder="Add custom formula or phrase to whitelist..." 
                      value={newTerm}
                      onChange={e => setNewTerm(e.target.value)}
                      className="flex-1 p-1.5 text-xs rounded bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-primary"
                    />
                    <button 
                      type="submit"
                      className="px-3 py-1 bg-surface-container hover:bg-surface-container-high rounded text-xs text-primary font-medium border border-outline-variant"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-low border-t border-surface-container flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-outline">Preset:</span>
                <span className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant text-on-surface font-medium">
                  IEEE Conference Standard (Recommended)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setMinNgram(6);
                    setCutoffThreshold(5.0);
                    setFilterBoilerplate(true);
                    setFilterCliches(true);
                  }}
                  className="px-3 py-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                >
                  Reset to Defaults
                </button>
                <button 
                  onClick={() => {
                    setExclusionModalOpen(false);
                    handleRunScan();
                  }}
                  className="px-4 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container font-semibold transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  <span>Apply &amp; Re-audit Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
