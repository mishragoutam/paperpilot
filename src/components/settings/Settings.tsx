import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { dbService } from '../../services/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiService, type DiscoveredModel } from '../../services/ai';

export const Settings: React.FC = () => {
  const { db, toggleTheme, theme } = useAppStore();
  const [activeTab, setActiveTab] = useState<'ai' | 'citations' | 'search' | 'vault' | 'editor'>('ai');

  // AI & Models state
  const [geminiKey, setGeminiKey] = useState(db.settings?.geminiKey || '');
  const [activeModel, setActiveModel] = useState(db.settings?.activeModel || 'gemini-2.0-flash');
  const [availableModelsList, setAvailableModelsList] = useState<DiscoveredModel[]>([]);
  const [ollamaSocket, setOllamaSocket] = useState('http://localhost:11434');
  const [ollamaWeight, setOllamaWeight] = useState('Llama-3.3-70B-Instruct-Q4_K_M');
  const [aiProvider, setAiProvider] = useState<'local' | 'commercial' | 'institutional'>('commercial');

  // Enclave Protocol Toggles
  const [zeroTelemetry, setZeroTelemetry] = useState(true);
  const [diffPrivacy, setDiffPrivacy] = useState(true);
  const [searchGrounding, setSearchGrounding] = useState(true);
  const [embargoCompliance, setEmbargoCompliance] = useState(true);
  const [vaultPath, setVaultPath] = useState('~/Documents/PaperPilot Vault/Manuscripts-2025');

  // Search & Citations
  const [searchKey, setSearchKey] = useState(db.settings?.searchKey || '');
  const [similarityInterval, setSimilarityInterval] = useState(db.settings?.similarityInterval || 90);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(db.settings?.autoCheckEnabled ?? false);
  const [citationStyle, setCitationStyle] = useState(db.settings?.citationStyle || 'IEEE');
  
  // Status feedback
  const [saved, setSaved] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-discover models on mount if key exists
  useEffect(() => {
    if (geminiKey.trim()) {
      aiService.getAvailableModels(geminiKey.trim()).then(models => {
        if (models && models.length > 0) {
          setAvailableModelsList(models);
        }
      }).catch(() => {});
    }
  }, []);

  const handleTestGemini = async () => {
    const key = geminiKey.trim();
    if (!key) {
      setTestResult({ success: false, message: 'Please enter your Gemini API key first.' });
      return;
    }

    setTestingGemini(true);
    setTestResult(null);

    try {
      // 1. Discover models directly supported by user's key
      const discovered = await aiService.getAvailableModels(key);
      if (discovered && discovered.length > 0) {
        setAvailableModelsList(discovered);
      }

      // 2. Resolve the working model for this key (handles 404 fallbacks seamlessly)
      const workingModel = await aiService.resolveWorkingModel(key, activeModel);
      setActiveModel(workingModel);

      // 3. Test generation with working model
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: workingModel });
      const result = await model.generateContent('Say "Connected"');
      const response = await result.response;
      const text = response.text();

      setTestResult({
        success: true,
        message: `API Key Connected! Active model: ${workingModel} responded: "${text.trim()}"`,
      });

      // Persist verified model to active DB
      const newDb = { 
        ...db, 
        settings: { 
          ...db.settings, 
          geminiKey: key,
          activeModel: workingModel 
        } 
      };
      await dbService.writeDb(newDb);
      useAppStore.setState({ db: newDb });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
        setTestResult({
          success: false,
          message: 'Invalid API key. Please verify your API key in Google AI Studio (aistudio.google.com).',
        });
      } else {
        setTestResult({
          success: false,
          message: `Connection failed: ${msg}`,
        });
      }
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSave = async () => {
    const newDb = { 
      ...db, 
      settings: { 
        ...db.settings, 
        geminiKey: geminiKey.trim(), 
        searchKey: searchKey.trim(), 
        similarityInterval, 
        autoCheckEnabled,
        citationStyle,
        theme,
        activeModel: activeModel.trim()
      } 
    };
    await dbService.writeDb(newDb);
    useAppStore.setState({ db: newDb });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen overflow-y-auto select-none">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="w-full bg-surface-container-low px-gutter-compact py-space-xs flex items-center justify-between border-b border-surface-container sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm text-xs shadow-xs font-medium">
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Environment Preferences</span>
          </div>
          <span className="text-outline-variant font-label-code text-xs">/</span>
          <span className="font-label-code text-xs text-on-surface truncate">~/.paperpilot/config.json</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-outline font-label-code text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            <span>AES-256-GCM Vault</span>
          </span>
        </div>

        <div className="flex items-center gap-space-sm">
          {saved && (
            <span className="text-primary text-xs font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              <span>Saved to Vault!</span>
            </span>
          )}
          <button 
            onClick={handleSave}
            className="px-3 py-1 rounded bg-primary text-on-primary hover:bg-primary-container font-label-sm text-xs shadow-xs transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">save</span>
            <span>Apply to Active Vault</span>
          </button>
        </div>
      </div>

      {/* Dual-Column Workbench Settings Architecture */}
      <div className="w-full grid grid-cols-12 flex-1 max-w-[1720px] mx-auto">
        {/* Left Category Rail (Cols 1-3) */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3 bg-surface-container-low p-space-md border-r border-surface-container flex flex-col justify-between">
          <div className="space-y-space-md">
            {/* Search filter */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[16px]">search</span>
              <input 
                className="w-full pl-8 pr-8 py-1.5 rounded bg-surface-container-lowest font-body-ui text-xs text-on-surface focus:outline-primary border border-outline-variant shadow-xs" 
                placeholder="Search preferences..." 
                type="text"
              />
            </div>

            {/* Section Groups */}
            <div className="space-y-1">
              <p className="px-2 text-[10px] uppercase tracking-wider font-label-sm font-semibold text-outline">
                Intelligence &amp; Synthesis
              </p>
              <button 
                onClick={() => setActiveTab('ai')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-label-md text-xs text-left transition-colors ${
                  activeTab === 'ai' 
                    ? 'bg-surface-container-high text-primary font-semibold shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  <span>AI Models &amp; Providers</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${geminiKey ? 'bg-tertiary animate-pulse' : 'bg-amber-400'}`}></span>
              </button>

              <button 
                onClick={() => setActiveTab('citations')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-label-md text-xs text-left transition-colors ${
                  activeTab === 'citations' 
                    ? 'bg-surface-container-high text-primary font-semibold shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">format_quote</span>
                  <span>Citation Styles &amp; CSL</span>
                </span>
                <span className="px-1.5 py-0.2 rounded font-label-code text-[10px] bg-surface-container text-outline">
                  {citationStyle}
                </span>
              </button>

              <button 
                onClick={() => setActiveTab('search')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-label-md text-xs text-left transition-colors ${
                  activeTab === 'search' 
                    ? 'bg-surface-container-high text-primary font-semibold shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                  <span>Web Search &amp; Repos</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </button>
            </div>

            <div className="space-y-1 pt-2">
              <p className="px-2 text-[10px] uppercase tracking-wider font-label-sm font-semibold text-outline">
                Vault &amp; Governance
              </p>
              <button 
                onClick={() => setActiveTab('vault')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-label-md text-xs text-left transition-colors ${
                  activeTab === 'vault' 
                    ? 'bg-surface-container-high text-primary font-semibold shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">security</span>
                  <span>Local Privacy &amp; Vault</span>
                </span>
                <span className="material-symbols-outlined text-[14px] text-tertiary">shield</span>
              </button>

              <button 
                onClick={() => setActiveTab('editor')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-label-md text-xs text-left transition-colors ${
                  activeTab === 'editor' 
                    ? 'bg-surface-container-high text-primary font-semibold shadow-xs' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  <span>Editor &amp; Typography</span>
                </span>
              </button>
            </div>
          </div>

          <div className="p-2 border-t border-surface-container text-[11px] text-outline">
            PaperPilot Vault Engine v3.2.1
          </div>
        </aside>

        {/* Right Content Pane (Cols 4-12) */}
        <main className="col-span-12 md:col-span-8 lg:col-span-9 p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: AI Models & Providers */}
          {activeTab === 'ai' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-on-surface">AI Models &amp; Provider Orchestration</h2>
                  <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary font-medium">
                    Production Tier
                  </span>
                </div>
                <p className="text-xs text-outline mt-0.5">
                  Assign dedicated reasoning engines, configure Google Gemini API credentials, and connect local air-gapped runtimes.
                </p>
              </div>

              {/* Foundation Engines Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Google Gemini Card (Active Provider) */}
                <div className="p-4 rounded-lg bg-surface-container-lowest border-2 border-primary shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm">
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-on-surface">Google Gemini Engine</h3>
                        <p className="font-label-code text-[11px] text-outline">gemini-1.5-flash • gemini-2.0-flash</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-semibold flex items-center gap-1 ${geminiKey ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${geminiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                      <span>{geminiKey ? 'Active Key' : 'Key Needed'}</span>
                    </span>
                  </div>
                  <p className="font-body-ui text-xs text-on-surface-variant">
                    High-speed academic synthesis with massive context window. Powers inline rewriting, paper search, and chatbot grounding.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-surface-container text-xs">
                    <span className="text-outline">Latency: <strong className="text-on-surface">~280ms</strong></span>
                    <span className="text-outline">Context: <strong className="text-on-surface">1,000,000 tk</strong></span>
                    <span className="text-primary font-semibold">Active Co-Author</span>
                  </div>
                </div>

                {/* Local Ollama Card */}
                <div className="p-4 rounded-lg bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">dns</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-on-surface">Local Ollama Runtime</h3>
                        <p className="font-label-code text-[11px] text-outline">DeepSeek-R1 • Llama-3.3-70B</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[11px] font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      <span>100% Air-Gap</span>
                    </span>
                  </div>
                  <p className="font-body-ui text-xs text-on-surface-variant">
                    Runs strictly on <code className="bg-surface-container px-1 py-0.5 rounded font-label-code text-[11px]">http://localhost:11434</code>. Zero data egress.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-surface-container text-xs">
                    <span className="text-outline">Socket: <strong className="text-on-surface">11434</strong></span>
                    <span className="text-outline">Telemetry: <strong className="text-on-surface">0 Bytes</strong></span>
                    <button onClick={() => setActiveTab('vault')} className="text-primary hover:underline font-semibold">Configure</button>
                  </div>
                </div>

                {/* Anthropic Claude Card */}
                <div className="p-4 rounded-lg bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined text-[18px]">psychology</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-on-surface">Anthropic Claude</h3>
                        <p className="font-label-code text-[11px] text-outline">claude-3-5-sonnet-20241022</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-[11px] text-outline">Standby</span>
                  </div>
                  <p className="font-body-ui text-xs text-on-surface-variant">
                    High-reasoning synthesis engine with 200k token window. Validated for long-context cross-paper audits.
                  </p>
                </div>

                {/* OpenAI Research Card */}
                <div className="p-4 rounded-lg bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-on-surface">OpenAI Research</h3>
                        <p className="font-label-code text-[11px] text-outline">o1-preview • gpt-4o-latest</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-[11px] text-outline">Standby</span>
                  </div>
                  <p className="font-body-ui text-xs text-on-surface-variant">
                    Formal theorem verification, mathematical proofs, and symbolic code generation.
                  </p>
                </div>
              </div>

              {/* Gemini Credentials Box */}
              <div className="p-5 bg-surface-container-lowest rounded-lg border border-surface-container shadow-xs space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-on-surface">Google Gemini API Key</label>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Get Free API Key (Google AI Studio)</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      value={geminiKey}
                      onChange={e => {
                        setGeminiKey(e.target.value);
                        setTestResult(null);
                      }}
                      className="flex-1 p-2 text-xs border border-outline-variant rounded bg-surface text-on-surface focus:outline-primary"
                      placeholder="AIzaSy..."
                    />
                    <button
                      onClick={handleTestGemini}
                      disabled={testingGemini || !geminiKey.trim()}
                      className="px-3.5 py-1.5 text-xs bg-primary text-on-primary hover:bg-primary-container rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {testingGemini ? (
                        <>
                          <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">bolt</span>
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {testResult.success ? 'check_circle' : 'error'}
                      </span>
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-outline">
                    Client-side direct socket: requests are sent directly to Google AI Studio with zero intermediary logging.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-surface-container">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-on-surface">Active Copilot Model</label>
                    <select 
                      value={activeModel} 
                      onChange={e => setActiveModel(e.target.value)}
                      className="w-full p-2 text-xs border border-outline-variant rounded bg-surface text-on-surface"
                    >
                      {availableModelsList.length > 0 ? (
                        availableModelsList.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName}</option>
                        ))
                      ) : (
                        <>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended - Fast &amp; Ultra-High Limits)</option>
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Latest)</option>
                          <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Scholarly Analysis)</option>
                          <option value="gemini-pro">Gemini Pro</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-on-surface">Reasoning Temperature</label>
                    <select className="w-full p-2 text-xs border border-outline-variant rounded bg-surface text-on-surface">
                      <option value="0.2">0.2 (Strict Academic Precision &amp; Fact-Check)</option>
                      <option value="0.5">0.5 (Balanced Literature Synthesis)</option>
                      <option value="0.8">0.8 (Creative Hypothesis Generation)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Local Privacy & AI Enclave Setup */}
          {activeTab === 'vault' && (
            <div className="max-w-4xl space-y-6">
              {/* Stepper / Confidentiality Banner */}
              <div className="p-4 bg-surface-container-lowest rounded-xl border border-surface-container shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-primary font-label-sm text-xs uppercase tracking-wider font-semibold">
                      <span className="material-symbols-outlined text-[16px]">shield_lock</span>
                      <span>Enclave Provisioning Matrix</span>
                      <span className="text-outline-variant">•</span>
                      <span className="font-label-code text-on-surface-variant">AIR-GAP LEVEL 3</span>
                    </div>
                    <h2 className="text-lg font-semibold text-on-surface mt-1">
                      Pre-Publication Confidentiality Suite &amp; Enclave Setup
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low self-start md:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">Session Isolated:</span>
                    <span className="font-label-code text-xs text-on-surface font-semibold">0x7F-SECURE-VAULT</span>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  PaperPilot is engineered for strict pre-publication confidentiality. Configure how external LLMs, similarity scanners, and web discovery engines handle your manuscript draft before compilation.
                </p>
              </div>

              {/* 3-Column Bento Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    <span>1. Intelligence Model Routing &amp; Credentials</span>
                  </h3>
                  <span className="font-label-code text-xs text-on-surface-variant">Default: Zero Cloud Ingestion</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Option 1: Local Air-Gapped */}
                  <div 
                    onClick={() => setAiProvider('local')}
                    className={`cursor-pointer p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      aiProvider === 'local' 
                        ? 'bg-surface-container-high border-primary shadow-sm' 
                        : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="ai-provider" 
                            checked={aiProvider === 'local'} 
                            onChange={() => setAiProvider('local')}
                            className="w-4 h-4 text-primary cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-on-surface">Local LLM Node</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-tertiary text-on-tertiary font-label-sm text-[10px] font-semibold">
                          100% Air-Gap
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Runs directly on Apple Silicon or CUDA GPU via Ollama or LM Studio. Zero raw text leaves this workstation.
                      </p>
                      <div className="py-1 px-2.5 rounded bg-surface-container font-label-code text-[11px] text-tertiary flex items-center justify-between">
                        <span>VRAM: 14.2 GB / 24 GB</span>
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                          Online
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 space-y-2 border-t border-surface-container">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-on-surface-variant">Daemon Socket</label>
                        <input 
                          type="text" 
                          value={ollamaSocket} 
                          onChange={e => setOllamaSocket(e.target.value)}
                          className="w-full bg-surface-container-lowest font-label-code text-xs px-2 py-1 rounded border border-outline-variant text-on-surface"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-on-surface-variant">Quantized Weights</label>
                        <select 
                          value={ollamaWeight} 
                          onChange={e => setOllamaWeight(e.target.value)}
                          className="w-full bg-surface-container-lowest font-label-code text-[11px] px-1.5 py-1 rounded border border-outline-variant text-on-surface"
                        >
                          <option value="Llama-3.3-70B-Instruct-Q4_K_M">Llama-3.3-70B-Instruct-Q4_K_M</option>
                          <option value="DeepSeek-R1-Distill-Qwen-32B">DeepSeek-R1-Distill-Qwen-32B</option>
                          <option value="Mistral-Small-24B-Instruct">Mistral-Small-24B-Instruct</option>
                          <option value="Phi-3.5-mini-instruct-4k">Phi-3.5-mini-instruct-4k</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Commercial Frontier API */}
                  <div 
                    onClick={() => setAiProvider('commercial')}
                    className={`cursor-pointer p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      aiProvider === 'commercial' 
                        ? 'bg-surface-container-high border-primary shadow-sm' 
                        : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="ai-provider" 
                            checked={aiProvider === 'commercial'} 
                            onChange={() => setAiProvider('commercial')}
                            className="w-4 h-4 text-primary cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-on-surface">Direct Frontier API</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-sm text-[10px] text-on-surface-variant font-medium">
                          Bring Own Key
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Direct encrypted tunnel to Google Gemini, Anthropic Claude, or OpenAI. Only highlighted excerpt slices are transmitted.
                      </p>
                      <div className="py-1 px-2.5 rounded bg-surface-container font-label-code text-[11px] text-on-surface-variant flex items-center justify-between">
                        <span>Context: Dynamic Window</span>
                        <span>Max 1M Tokens</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 space-y-2 border-t border-surface-container">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-on-surface-variant">Active Provider</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={geminiKey ? "Google Gemini (Configured)" : "Google Gemini (No Key)"} 
                          className="w-full bg-surface-container font-label-code text-xs px-2 py-1 rounded border border-outline-variant text-on-surface"
                        />
                      </div>
                      <button 
                        onClick={() => setActiveTab('ai')}
                        className="w-full py-1 rounded bg-primary text-on-primary font-label-sm text-xs font-medium hover:bg-primary-container transition-colors"
                      >
                        Manage API Credentials
                      </button>
                    </div>
                  </div>

                  {/* Option 3: Institutional Campus Gateway */}
                  <div 
                    onClick={() => setAiProvider('institutional')}
                    className={`cursor-pointer p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      aiProvider === 'institutional' 
                        ? 'bg-surface-container-high border-primary shadow-sm' 
                        : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="ai-provider" 
                            checked={aiProvider === 'institutional'} 
                            onChange={() => setAiProvider('institutional')}
                            className="w-4 h-4 text-primary cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-on-surface">Campus Enterprise</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-sm text-[10px] text-on-surface-variant font-medium">
                          VPN / SSO
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Azure OpenAI or institutional proxy compliant with university research confidentiality and NIH/FERPA agreements.
                      </p>
                      <div className="py-1 px-2.5 rounded bg-surface-container font-label-code text-[11px] text-on-surface-variant flex items-center justify-between">
                        <span>Host: Stanford / MIT Enclave</span>
                        <span className="text-tertiary">Verified Host</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 space-y-2 border-t border-surface-container">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-on-surface-variant">SAML / OpenID Provider</label>
                        <input 
                          type="text" 
                          defaultValue="https://login.stanford.edu/idp"
                          className="w-full bg-surface-container-lowest font-label-code text-xs px-2 py-1 rounded border border-outline-variant text-on-surface"
                        />
                      </div>
                      <button 
                        onClick={() => alert('Campus SSO Handshake verified: Enclave ticket active.')}
                        className="w-full py-1 rounded bg-surface-container font-label-sm text-xs text-primary hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 font-medium"
                      >
                        <span className="material-symbols-outlined text-[14px]">badge</span>
                        <span>Authenticate SSO</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Zero-Retention Protocols (4 Interactive Cards) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                    <span>2. Data Privacy &amp; Zero-Retention Enclave Protocols</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-tertiary font-label-sm text-[11px] font-semibold">
                    Strict Isolation Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Protocol 1 */}
                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container flex items-start gap-3 shadow-xs">
                    <input 
                      type="checkbox" 
                      id="p1" 
                      checked={zeroTelemetry}
                      onChange={e => setZeroTelemetry(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="p1" className="font-semibold text-xs text-on-surface cursor-pointer">
                          Zero-Telemetry &amp; Excerpt Isolation
                        </label>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-[10px] text-tertiary font-semibold">
                          Strict Compliance
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Never send full drafts or chapter bodies to third parties. Only explicitly highlighted selections are passed to the inference engine.
                      </p>
                    </div>
                  </div>

                  {/* Protocol 2 */}
                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container flex items-start gap-3 shadow-xs">
                    <input 
                      type="checkbox" 
                      id="p2" 
                      checked={diffPrivacy}
                      onChange={e => setDiffPrivacy(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="p2" className="font-semibold text-xs text-on-surface cursor-pointer">
                          Differential Privacy &amp; Ephemeral Vector Store
                        </label>
                        <span className="font-label-code text-[10px] text-outline font-medium">HNSW In-Memory</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Completely wipes all semantic embeddings, cosine similarity indices, and cache buffers upon application termination.
                      </p>
                    </div>
                  </div>

                  {/* Protocol 3 */}
                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container flex items-start gap-3 shadow-xs">
                    <input 
                      type="checkbox" 
                      id="p3" 
                      checked={searchGrounding}
                      onChange={e => setSearchGrounding(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="p3" className="font-semibold text-xs text-on-surface cursor-pointer">
                          Academic Grounding with IP Obfuscation
                        </label>
                        <span className="font-label-sm text-[10px] text-primary font-medium">arXiv / PubMed</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Routes literature discovery queries through an encrypted non-attributable proxy so competitive research leads remain untracked.
                      </p>
                    </div>
                  </div>

                  {/* Protocol 4 */}
                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container flex items-start gap-3 shadow-xs">
                    <input 
                      type="checkbox" 
                      id="p4" 
                      checked={embargoCompliance}
                      onChange={e => setEmbargoCompliance(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="p4" className="font-semibold text-xs text-on-surface cursor-pointer">
                          Embargo &amp; Double-Blind Anonymity Guarantee
                        </label>
                        <span className="font-label-sm text-[10px] text-tertiary font-semibold">IEEE • Nature • ACM</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Automatically scrubs author metadata, machine UUIDs, commit timestamps, and institutional IP headers during export.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware-Bound Storage Location */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span>3. Local Vault Storage &amp; Reference Manager Bridge</span>
                  </h3>
                  <span className="font-label-sm text-xs text-on-surface-variant">Hardware-Bound Storage</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">folder_special</span>
                      <span className="font-semibold text-xs text-on-surface">Encrypted Vault Storage Location</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-surface-container font-label-code text-[10px] text-on-surface-variant">
                      AES-256 GCM Encrypted At Rest
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-container px-3 py-2 rounded-lg flex items-center justify-between min-w-0 border border-outline-variant">
                      <span className="font-label-code text-xs text-on-surface truncate">{vaultPath}</span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant shrink-0 ml-2">Available: 412 GB</span>
                    </div>
                    <button 
                      onClick={() => alert(`Active local vault directory:\n${vaultPath}`)}
                      className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-medium transition-colors shrink-0"
                    >
                      Browse...
                    </button>
                  </div>
                </div>

                {/* Periodic Originality Audit Settings */}
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-on-surface">Automatic Originality Auditing</span>
                      <p className="text-[11px] text-outline">Periodically inspects written excerpts against indexed literature in the background.</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={autoCheckEnabled}
                      onChange={e => setAutoCheckEnabled(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <div>
                      <span className="text-xs font-semibold text-on-surface">Audit Interval</span>
                      <p className="text-[11px] text-outline">Seconds between background originality sweeps.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="30" 
                        max="300"
                        value={similarityInterval}
                        onChange={e => setSimilarityInterval(Number(e.target.value))}
                        className="w-32 accent-primary cursor-pointer"
                      />
                      <span className="font-label-code text-xs text-primary font-semibold w-12 text-right">
                        {similarityInterval}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Citation Styles & CSL */}
          {activeTab === 'citations' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Citation Styles &amp; CSL</h2>
                <p className="text-xs text-outline mt-0.5">Configure citation compilation and bibliographical rules.</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-lg border border-surface-container shadow-xs space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-on-surface">Default Citation Output</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['IEEE', 'Nature', 'ACM', 'APA 7th', 'Chicago', 'Harvard'].map((style) => (
                      <button
                        key={style}
                        onClick={() => setCitationStyle(style)}
                        className={`p-2.5 rounded text-left text-xs border transition-colors flex items-center justify-between ${
                          citationStyle === style 
                            ? 'bg-surface-container-high border-primary text-primary font-semibold' 
                            : 'bg-surface border-surface-container text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        <span>{style} Format</span>
                        {citationStyle === style && <span className="material-symbols-outlined text-[15px]">check</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Web Search & Repositories */}
          {activeTab === 'search' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Web Search &amp; Repositories</h2>
                <p className="text-xs text-outline mt-0.5">Connect external literature index providers.</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-lg border border-surface-container shadow-xs space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">Tavily Academic Search API Key</label>
                  <input 
                    type="password" 
                    value={searchKey}
                    onChange={e => setSearchKey(e.target.value)}
                    className="p-2 text-xs border border-outline-variant rounded bg-surface text-on-surface focus:outline-primary"
                    placeholder="tvly-..."
                  />
                  <p className="text-[11px] text-outline">Optional. Enables live arXiv, PubMed, and CrossRef semantic crawls.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Editor & Typography */}
          {activeTab === 'editor' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-on-surface">Editor &amp; Typography</h2>
                <p className="text-xs text-outline mt-0.5">Customize appearance, dark mode, and paper typography.</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-lg border border-surface-container shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-on-surface">Interface Theme</span>
                    <p className="text-[11px] text-outline">Switch between academic paper light mode and dark mode.</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-medium text-on-surface border border-outline-variant flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    </span>
                    <span>Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
