import React, { useState, useEffect } from 'react';
import { type Editor as TiptapEditor } from '@tiptap/react';
import { useAppStore } from '../../store/useAppStore';
import { aiService } from '../../services/ai';

interface WorkspaceRibbonProps {
  editor: TiptapEditor | null;
  onExport: (format: 'md' | 'html' | 'txt' | 'tex') => void;
  onAiAction: (action: 'rewrite' | 'sources' | 'summarize') => void;
}

export const WorkspaceRibbon: React.FC<WorkspaceRibbonProps> = ({
  editor,
  onExport,
  onAiAction,
}) => {
  const {
    db,
    activeDocumentId,
    activeProjectId,
    setCurrentView,
    toggleLeftPanel,
    toggleRightPanel,
    toggleTheme,
    theme,
    aiSpeedMode,
    setAiSpeedMode,
    activeRibbonTab,
    setActiveRibbonTab,
    ribbonCollapsed,
    toggleRibbonCollapsed,
    updateProjectTemplate,
  } = useAppStore();

  const geminiKey = db.settings?.geminiKey || '';
  const activeDoc = db.documents.find(d => d.id === activeDocumentId);
  const activeProject = db.projects.find(p => p.id === activeProjectId);
  const currentTemplate = activeProject?.template || 'IEEE Transactions';

  // Dropdown states
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editingModeOpen, setEditingModeOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<'Editing' | 'Reviewing' | 'Viewing'>('Editing');
  const [shareOpen, setShareOpen] = useState(false);
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Source Serif 4');
  const [selectedFontSize, setSelectedFontSize] = useState('11');
  const [changeCaseOpen, setChangeCaseOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [lineSpacingOpen, setLineSpacingOpen] = useState(false);
  const [bordersOpen, setBordersOpen] = useState(false);
  const [stylesGalleryOpen, setStylesGalleryOpen] = useState(false);
  const [editingMenuOpen, setEditingMenuOpen] = useState(false);
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false);
  const [pasteSpecialOpen, setPasteSpecialOpen] = useState(false);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [savedMarks, setSavedMarks] = useState<any>(null);

  // Active states from Tiptap editor
  const isBold = editor?.isActive('bold') || false;
  const isItalic = editor?.isActive('italic') || false;
  const isUnderline = editor?.isActive('underline') || false;
  const isStrike = editor?.isActive('strike') || false;
  const isSubscript = editor?.isActive('subscript') || false;
  const isSuperscript = editor?.isActive('superscript') || false;
  const isBulletList = editor?.isActive('bulletList') || false;
  const isOrderedList = editor?.isActive('orderedList') || false;
  const isAlignLeft = editor?.isActive({ textAlign: 'left' }) || (!editor?.isActive({ textAlign: 'center' }) && !editor?.isActive({ textAlign: 'right' }) && !editor?.isActive({ textAlign: 'justify' }));
  const isAlignCenter = editor?.isActive({ textAlign: 'center' }) || false;
  const isAlignRight = editor?.isActive({ textAlign: 'right' }) || false;
  const isAlignJustify = editor?.isActive({ textAlign: 'justify' }) || false;
  const isHeading1 = editor?.isActive('heading', { level: 1 }) || false;
  const isHeading2 = editor?.isActive('heading', { level: 2 }) || false;
  const isHeading3 = editor?.isActive('heading', { level: 3 }) || false;
  const isNormalText = !isHeading1 && !isHeading2 && !isHeading3;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.ribbon-dropdown-container')) {
        setFileMenuOpen(false);
        setEditingModeOpen(false);
        setShareOpen(false);
        setFontFamilyOpen(false);
        setFontSizeOpen(false);
        setChangeCaseOpen(false);
        setHighlightPickerOpen(false);
        setColorPickerOpen(false);
        setLineSpacingOpen(false);
        setBordersOpen(false);
        setStylesGalleryOpen(false);
        setEditingMenuOpen(false);
        setAssistantMenuOpen(false);
        setPasteSpecialOpen(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  // --- Formatting Helpers ---
  const handlePaste = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    } catch {
      editor.commands.focus();
      document.execCommand('paste');
    }
  };

  const handleCopy = () => {
    if (!editor) return;
    document.execCommand('copy');
  };

  const handleCut = () => {
    if (!editor) return;
    document.execCommand('cut');
  };

  const handleFormatPainter = () => {
    if (!editor) return;
    if (!formatPainterActive) {
      setSavedMarks({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strike: isStrike,
        heading1: isHeading1,
        heading2: isHeading2,
      });
      setFormatPainterActive(true);
    } else {
      if (savedMarks) {
        if (savedMarks.bold) editor.chain().focus().setBold().run();
        if (savedMarks.italic) editor.chain().focus().setItalic().run();
        if (savedMarks.underline) editor.chain().focus().setUnderline().run();
        if (savedMarks.strike) editor.chain().focus().setStrike().run();
      }
      setFormatPainterActive(false);
      setSavedMarks(null);
    }
  };

  const handleClearFormatting = () => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  const handleChangeCase = (mode: 'upper' | 'lower' | 'title') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    let transformed = selected;
    if (mode === 'upper') transformed = selected.toUpperCase();
    if (mode === 'lower') transformed = selected.toLowerCase();
    if (mode === 'title') transformed = selected.replace(/\b\w/g, c => c.toUpperCase());
    editor.chain().focus().insertContentAt({ from, to }, transformed).run();
    setChangeCaseOpen(false);
  };

  const ribbonTabs: Array<{ id: any; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'design', label: 'Design' },
    { id: 'layout', label: 'Layout' },
    { id: 'references', label: 'References' },
    { id: 'mailings', label: 'Mailings' },
    { id: 'review', label: 'Review' },
    { id: 'view', label: 'View' },
    { id: 'help', label: 'Help' },
  ];

  return (
    <div className="bg-[#f3f4f6] dark:bg-[#161d2d] border-b border-[#dadce0] dark:border-[#263148] select-none shrink-0 z-30">
      {/* =========================================================================
          ROW 1: WORD RIBBON TABS BAR (Height ~34px)
          File | Home | Insert | Design | Layout | References | Mailings | Review | View | Help
          On Right: Comments | Editing ∨ | Share ∨
      ========================================================================= */}
      <div className="h-[34px] px-2 flex items-center justify-between border-b border-[#e1e3e6] dark:border-[#263148] text-xs">
        {/* Left Tabs */}
        <nav className="flex items-center h-full gap-0.5">
          {/* Word File Tab Button */}
          <div className="relative h-full flex items-center ribbon-dropdown-container">
            <button
              onClick={() => setFileMenuOpen(!fileMenuOpen)}
              className="h-[28px] px-3.5 rounded text-white bg-[#106ebe] hover:bg-[#005a9e] font-semibold text-[11px] flex items-center transition-colors shadow-xs"
              type="button"
            >
              File
            </button>

            {/* Word File Backstage Menu */}
            {fileMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#1a2133] rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 text-[12px]">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Document Vault</div>
                <button 
                  onClick={() => { setCurrentView('library'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2.5 text-gray-800 dark:text-gray-200"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#106ebe]">folder_open</span>
                  <div>
                    <div className="font-medium">Projects Library</div>
                    <div className="text-[10px] text-gray-500">Switch manuscript section</div>
                  </div>
                </button>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Export Manuscript</div>
                <button 
                  onClick={() => { onExport('tex'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-teal-600">functions</span>
                  <span>LaTeX Source (.tex)</span>
                </button>
                <button 
                  onClick={() => { onExport('md'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">markdown</span>
                  <span>Markdown Document (.md)</span>
                </button>
                <button 
                  onClick={() => { onExport('html'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-600">html</span>
                  <span>Standalone Web HTML</span>
                </button>
                <button 
                  onClick={() => { onExport('txt'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-gray-500">description</span>
                  <span>Plain Text (.txt)</span>
                </button>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <button 
                  onClick={() => { setCurrentView('settings'); setFileMenuOpen(false); }} 
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 text-gray-700 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-gray-600">tune</span>
                  <span>Options & Fast Engine</span>
                </button>
              </div>
            )}
          </div>

          {/* Standard Word Tabs */}
          {ribbonTabs.map((tab) => {
            const isActive = activeRibbonTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveRibbonTab(tab.id)}
                className={`h-full px-3 text-[11px] font-medium transition-colors flex items-center relative ${
                  isActive
                    ? 'text-[#106ebe] dark:text-[#7bb0f5] font-semibold bg-white dark:bg-[#1b2234] border-t-2 border-t-transparent'
                    : 'text-[#444746] dark:text-[#c4c7c5] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                type="button"
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#106ebe] dark:bg-[#7bb0f5]"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Comments, Editing ∨, Share ∨ */}
        <div className="flex items-center gap-1.5 ribbon-dropdown-container">
          {/* Comments Button */}
          <button
            onClick={() => {}}
            className="h-6 px-2.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#444746] dark:text-[#c4c7c5] flex items-center gap-1 text-[11px] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">chat_bubble_outline</span>
            <span>Comments</span>
          </button>

          {/* Editing Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => setEditingModeOpen(!editingModeOpen)}
              className="h-6 px-2.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#444746] dark:text-[#c4c7c5] flex items-center gap-1 text-[11px] transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span>{editingMode}</span>
              <span className="material-symbols-outlined text-[12px]">expand_more</span>
            </button>
            {editingModeOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                {(['Editing', 'Reviewing', 'Viewing'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setEditingMode(mode);
                      setEditingModeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between ${
                      editingMode === mode ? 'font-semibold text-primary' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{mode}</span>
                    {editingMode === mode && <span className="material-symbols-outlined text-[13px]">check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Signature Word Blue Share Button */}
          <div className="relative">
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className="h-[24px] px-3 rounded-full bg-[#106ebe] hover:bg-[#005a9e] text-white font-medium text-[11px] flex items-center gap-1 transition-colors shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[13px]">share</span>
              <span>Share</span>
              <span className="material-symbols-outlined text-[12px]">expand_more</span>
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                <button onClick={() => onExport('tex')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <span className="material-symbols-outlined text-[15px] text-teal-600">functions</span>
                  <span>Export LaTeX (.tex)</span>
                </button>
                <button onClick={() => onExport('md')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <span className="material-symbols-outlined text-[15px] text-primary">markdown</span>
                  <span>Export Markdown (.md)</span>
                </button>
                <button onClick={() => onExport('html')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">html</span>
                  <span>Export Standalone HTML</span>
                </button>
                <button onClick={() => onExport('txt')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <span className="material-symbols-outlined text-[15px] text-gray-500">description</span>
                  <span>Export Plain Text</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: MICROSOFT WORD RIBBON COMMAND BAR (Height ~92px)
          Matches the screenshot layout, grouping, and bottom labels
      ========================================================================= */}
      {!ribbonCollapsed && (
        <div className="h-[92px] px-2.5 bg-[#f5f6f8] dark:bg-[#1b2234] flex items-center justify-between text-xs select-none shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-x-auto scrollbar-none">
          {/* HOME TAB RIBBON CONTENT */}
          {activeRibbonTab === 'home' && (
            <div className="flex items-stretch h-full py-1 gap-1 ribbon-dropdown-container">
              {/* GROUP 1: CLIPBOARD */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-1.5 flex-1 pt-0.5">
                  {/* Big Paste Button */}
                  <div className="relative">
                    <button
                      onClick={handlePaste}
                      className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#202124] dark:text-[#e4e7ec] transition-colors"
                      title="Paste (Ctrl+V)"
                      type="button"
                    >
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-0.5">
                        <span className="material-symbols-outlined text-[22px]">content_paste</span>
                      </div>
                      <div className="flex items-center gap-0.5 font-medium text-[11px] leading-tight">
                        <span>Paste</span>
                        <span 
                          onClick={(e) => { e.stopPropagation(); setPasteSpecialOpen(!pasteSpecialOpen); }}
                          className="material-symbols-outlined text-[13px] text-gray-500 hover:text-black"
                        >
                          arrow_drop_down
                        </span>
                      </div>
                    </button>
                    {pasteSpecialOpen && (
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                        <button onClick={() => { handlePaste(); setPasteSpecialOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-primary">content_paste</span>
                          <span>Paste Normal</span>
                        </button>
                        <button onClick={async () => {
                          const text = await navigator.clipboard.readText();
                          if (text && editor) editor.chain().focus().insertContent(text.replace(/<[^>]+>/g, '')).run();
                          setPasteSpecialOpen(false);
                        }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-gray-500">text_format</span>
                          <span>Keep Text Only</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Vertical Column: Cut, Copy, Format Painter */}
                  <div className="flex flex-col justify-center gap-0.5">
                    <button
                      onClick={handleCut}
                      className="h-5 px-1.5 rounded flex items-center gap-1.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] hover:text-black dark:hover:text-white transition-colors text-[11px]"
                      title="Cut (Ctrl+X)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_cut</span>
                      <span>Cut</span>
                    </button>
                    <button
                      onClick={handleCopy}
                      className="h-5 px-1.5 rounded flex items-center gap-1.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] hover:text-black dark:hover:text-white transition-colors text-[11px]"
                      title="Copy (Ctrl+C)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={handleFormatPainter}
                      className={`h-5 px-1.5 rounded flex items-center gap-1.5 transition-colors text-[11px] ${
                        formatPainterActive 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' 
                          : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Format Painter"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px] text-amber-600 dark:text-amber-400">brush</span>
                      <span>Format Painter</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Label */}
                <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Clipboard</span>
                  <span className="material-symbols-outlined text-[11px] opacity-60 hover:opacity-100 cursor-pointer">open_in_new</span>
                </div>
              </div>

              {/* GROUP 2: FONT */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex flex-col gap-1 pt-0.5">
                  {/* Row 1: Font Family, Size, Grow, Shrink, Case, Clear */}
                  <div className="flex items-center gap-1">
                    {/* Font Family Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setFontFamilyOpen(!fontFamilyOpen)}
                        className="h-6 px-2 rounded bg-white dark:bg-[#151c2c] border border-gray-300 dark:border-gray-600 hover:border-gray-400 flex items-center justify-between gap-1 text-[#202124] dark:text-[#e4e7ec] w-32 text-[11px] font-medium"
                        type="button"
                      >
                        <span className="truncate">{selectedFont}</span>
                        <span className="material-symbols-outlined text-[14px] text-gray-500">arrow_drop_down</span>
                      </button>
                      {fontFamilyOpen && (
                        <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                          {['Calibri', 'Source Serif 4', 'Times New Roman', 'Arial', 'Inter', 'Georgia', 'JetBrains Mono'].map((f) => (
                            <button
                              key={f}
                              onClick={() => {
                                setSelectedFont(f);
                                setFontFamilyOpen(false);
                              }}
                              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec]"
                              style={{ fontFamily: f }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Font Size Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setFontSizeOpen(!fontSizeOpen)}
                        className="h-6 px-1.5 rounded bg-white dark:bg-[#151c2c] border border-gray-300 dark:border-gray-600 hover:border-gray-400 flex items-center justify-between gap-0.5 text-[#202124] dark:text-[#e4e7ec] w-12 text-[11px]"
                        type="button"
                      >
                        <span>{selectedFontSize}</span>
                        <span className="material-symbols-outlined text-[13px] text-gray-500">arrow_drop_down</span>
                      </button>
                      {fontSizeOpen && (
                        <div className="absolute left-0 top-full mt-1 w-16 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px] max-h-48 overflow-y-auto">
                          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setSelectedFontSize(String(s));
                                setFontSizeOpen(false);
                              }}
                              className="w-full text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec]"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Grow / Shrink */}
                    <button
                      onClick={() => setSelectedFontSize(prev => String(Math.min(72, Number(prev) + 1)))}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Increase Font Size"
                      type="button"
                    >
                      <span className="font-bold text-[12px] flex items-center">A<sup className="text-[9px] -top-1">▲</sup></span>
                    </button>
                    <button
                      onClick={() => setSelectedFontSize(prev => String(Math.max(8, Number(prev) - 1)))}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Decrease Font Size"
                      type="button"
                    >
                      <span className="font-normal text-[11px] flex items-center">A<sub className="text-[9px] bottom-0">▼</sub></span>
                    </button>

                    {/* Change Case Aa */}
                    <div className="relative">
                      <button
                        onClick={() => setChangeCaseOpen(!changeCaseOpen)}
                        className="w-7 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                        title="Change Case"
                        type="button"
                      >
                        <span className="font-semibold text-[11px]">Aa</span>
                        <span className="material-symbols-outlined text-[11px]">arrow_drop_down</span>
                      </button>
                      {changeCaseOpen && (
                        <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                          <button onClick={() => handleChangeCase('title')} className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">Sentence case</button>
                          <button onClick={() => handleChangeCase('lower')} className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">lowercase</button>
                          <button onClick={() => handleChangeCase('upper')} className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">UPPERCASE</button>
                          <button onClick={() => handleChangeCase('title')} className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">Capitalize Each Word</button>
                        </div>
                      )}
                    </div>

                    {/* Clear All Formatting */}
                    <button
                      onClick={handleClearFormatting}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-pink-600 dark:text-pink-400"
                      title="Clear All Formatting"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">ink_eraser</span>
                    </button>
                  </div>

                  {/* Row 2: B, I, U, Strike, Sub, Super, Font Color, Highlight */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[12px] transition-colors ${
                        isBold ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Bold (Ctrl+B)"
                      type="button"
                    >
                      B
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`w-6 h-6 rounded flex items-center justify-center italic font-serif text-[13px] transition-colors ${
                        isItalic ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Italic (Ctrl+I)"
                      type="button"
                    >
                      I
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={`w-7 h-6 rounded flex items-center justify-center underline text-[12px] transition-colors ${
                        isUnderline ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Underline (Ctrl+U)"
                      type="button"
                    >
                      <span>U</span>
                      <span className="material-symbols-outlined text-[11px] ml-0.5">arrow_drop_down</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleStrike().run()}
                      className={`w-6 h-6 rounded flex items-center justify-center line-through text-[11px] transition-colors ${
                        isStrike ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Strikethrough"
                      type="button"
                    >
                      ab
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleSubscript().run()}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[11px] transition-colors ${
                        isSubscript ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Subscript (Ctrl+=)"
                      type="button"
                    >
                      <span>x<sub className="text-[9px]">2</sub></span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleSuperscript().run()}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[11px] transition-colors ${
                        isSuperscript ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Superscript (Ctrl+Shift++)"
                      type="button"
                    >
                      <span>x<sup className="text-[9px]">2</sup></span>
                    </button>

                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    {/* Highlight Marker Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => editor?.chain().focus().toggleHighlight().run()}
                        className="w-7 h-6 rounded flex flex-col items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                        title="Highlight Text Color"
                        type="button"
                      >
                        <div className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px] text-yellow-600 dark:text-yellow-400">border_color</span>
                          <span 
                            onClick={(e) => { e.stopPropagation(); setHighlightPickerOpen(!highlightPickerOpen); }}
                            className="material-symbols-outlined text-[10px]"
                          >
                            arrow_drop_down
                          </span>
                        </div>
                        <div className="w-4 h-1 bg-yellow-400 rounded-sm"></div>
                      </button>
                      {highlightPickerOpen && (
                        <div className="absolute left-0 top-full mt-1 p-2 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 z-50 grid grid-cols-4 gap-1.5 w-32">
                          {['#fef08a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#fed7aa', '#ddd6fe', '#e2e8f0', '#ffffff'].map(c => (
                            <div
                              key={c}
                              onClick={() => {
                                editor?.chain().focus().setHighlight({ color: c }).run();
                                setHighlightPickerOpen(false);
                              }}
                              className="w-5 h-5 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Font Color Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => editor?.chain().focus().setColor('#131b2e').run()}
                        className="w-7 h-6 rounded flex flex-col items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                        title="Font Color"
                        type="button"
                      >
                        <div className="flex items-center gap-0.5">
                          <span className="font-bold text-[12px]">A</span>
                          <span 
                            onClick={(e) => { e.stopPropagation(); setColorPickerOpen(!colorPickerOpen); }}
                            className="material-symbols-outlined text-[10px]"
                          >
                            arrow_drop_down
                          </span>
                        </div>
                        <div className="w-4 h-1 bg-red-600 rounded-sm"></div>
                      </button>
                      {colorPickerOpen && (
                        <div className="absolute left-0 top-full mt-1 p-2 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 z-50 grid grid-cols-4 gap-1.5 w-32">
                          {['#131b2e', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#475569', '#0284c7'].map(c => (
                            <div
                              key={c}
                              onClick={() => {
                                editor?.chain().focus().setColor(c).run();
                                setColorPickerOpen(false);
                              }}
                              className="w-5 h-5 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Label */}
                <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Font</span>
                  <span className="material-symbols-outlined text-[11px] opacity-60 hover:opacity-100 cursor-pointer">open_in_new</span>
                </div>
              </div>

              {/* GROUP 3: PARAGRAPH */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex flex-col gap-1 pt-0.5">
                  {/* Row 1: Bullets, Numbering, Multilevel, Indent Out, Indent In, Sort, Paragraph Marks */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      className={`h-6 px-1 rounded flex items-center gap-0.5 transition-colors ${
                        isBulletList ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Bullets"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      className={`h-6 px-1 rounded flex items-center gap-0.5 transition-colors ${
                        isOrderedList ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Numbering"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_list_numbered</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                    </button>
                    <button
                      onClick={() => {}}
                      className="h-6 px-1 rounded flex items-center gap-0.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                      title="Multilevel List"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">checklist</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                    </button>

                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5"></div>

                    <button
                      onClick={() => editor?.chain().focus().liftListItem('listItem').run()}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Decrease Indent"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_indent_decrease</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Increase Indent"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_indent_increase</span>
                    </button>
                    <button
                      onClick={() => {}}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Sort Citations"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">sort_by_alpha</span>
                    </button>
                    <button
                      onClick={() => {}}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Show/Hide ¶ Paragraph Marks"
                      type="button"
                    >
                      <span className="font-serif text-[14px] font-bold">¶</span>
                    </button>
                  </div>

                  {/* Row 2: Align Left, Center, Align Right, Justify, Line Spacing, Shading, Borders */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        isAlignLeft ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Align Left (Ctrl+L)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_align_left</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        isAlignCenter ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Center (Ctrl+E)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_align_center</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        isAlignRight ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Align Right (Ctrl+R)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_align_right</span>
                    </button>
                    <button
                      onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        isAlignJustify ? 'bg-[#cdd3dd] dark:bg-[#344260] text-primary' : 'text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]'
                      }`}
                      title="Justify (Ctrl+J)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">format_align_justify</span>
                    </button>

                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5"></div>

                    {/* Line Spacing Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setLineSpacingOpen(!lineSpacingOpen)}
                        className="w-7 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                        title="Line and Paragraph Spacing"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[15px]">format_line_spacing</span>
                        <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                      </button>
                      {lineSpacingOpen && (
                        <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                          {['1.0 Single', '1.15 IEEE Standard', '1.5 Lines', '2.0 Double Spaced'].map(s => (
                            <button
                              key={s}
                              onClick={() => setLineSpacingOpen(false)}
                              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec]"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Paint Bucket Shading */}
                    <button
                      onClick={() => {}}
                      className="w-7 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                      title="Shading"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px] text-cyan-600 dark:text-cyan-400">format_color_fill</span>
                      <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                    </button>

                    {/* Borders */}
                    <div className="relative">
                      <button
                        onClick={() => setBordersOpen(!bordersOpen)}
                        className="w-7 h-6 rounded flex items-center justify-center hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#3c4043] dark:text-[#c4c7c5]"
                        title="Borders"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[15px]">border_all</span>
                        <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                      </button>
                      {bordersOpen && (
                        <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-[#1a2133] rounded shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-[11px]">
                          {['Bottom Border', 'Top Border', 'Left Border', 'Right Border', 'No Border', 'All Borders'].map(b => (
                            <button
                              key={b}
                              onClick={() => setBordersOpen(false)}
                              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec]"
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Label */}
                <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Paragraph</span>
                  <span className="material-symbols-outlined text-[11px] opacity-60 hover:opacity-100 cursor-pointer">open_in_new</span>
                </div>
              </div>

              {/* GROUP 4: STYLES GALLERY */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-1 pt-0.5">
                  <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#151c2c] rounded border border-gray-300 dark:border-gray-600">
                    {/* Normal */}
                    <button
                      onClick={() => editor?.chain().focus().setParagraph().run()}
                      className={`h-11 px-2.5 rounded flex flex-col justify-center items-center text-center transition-all border ${
                        isNormalText
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec]'
                      }`}
                      title="Normal Text"
                      type="button"
                    >
                      <span className="font-normal text-[11px]">AaBbCc</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Normal</span>
                    </button>

                    {/* No Spacing */}
                    <button
                      onClick={() => editor?.chain().focus().setParagraph().run()}
                      className="h-11 px-2.5 rounded flex flex-col justify-center items-center text-center hover:bg-gray-100 dark:hover:bg-gray-800 text-[#202124] dark:text-[#e4e7ec] border border-transparent"
                      title="No Spacing"
                      type="button"
                    >
                      <span className="font-normal text-[11px] leading-none">AaBbCc</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">No Spacing</span>
                    </button>

                    {/* Heading 1 */}
                    <button
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`h-11 px-2.5 rounded flex flex-col justify-center items-center text-center transition-all border ${
                        isHeading1
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-[#2b579a] dark:text-[#6ba1e6]'
                      }`}
                      title="Heading 1"
                      type="button"
                    >
                      <span className="font-bold text-[13px] leading-tight">AaBbCc</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Heading 1</span>
                    </button>

                    {/* Heading 2 */}
                    <button
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`h-11 px-2.5 rounded flex flex-col justify-center items-center text-center transition-all border ${
                        isHeading2
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-[#2b579a] dark:text-[#6ba1e6]'
                      }`}
                      title="Heading 2"
                      type="button"
                    >
                      <span className="font-semibold text-[12px] leading-tight">AaBbCc</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Heading 2</span>
                    </button>

                    {/* Scroll buttons */}
                    <div className="flex flex-col justify-between h-11 border-l border-gray-200 dark:border-gray-700 pl-1">
                      <button className="w-4 h-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[10px]">keyboard_arrow_up</span>
                      </button>
                      <button className="w-4 h-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[10px]">keyboard_arrow_down</span>
                      </button>
                      <button 
                        onClick={() => setStylesGalleryOpen(!stylesGalleryOpen)}
                        className="w-4 h-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                      >
                        <span className="material-symbols-outlined text-[10px]">expand_more</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Label */}
                <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Styles</span>
                  <span className="material-symbols-outlined text-[11px] opacity-60 hover:opacity-100 cursor-pointer">open_in_new</span>
                </div>
              </div>

              {/* GROUP 5: EDITING */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex flex-col justify-center gap-0.5 pt-0.5">
                  <button
                    onClick={() => {
                      const q = prompt('Find in manuscript:');
                      if (q) window.find(q);
                    }}
                    className="h-5 px-1.5 rounded flex items-center gap-1.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[11px]"
                    title="Find (Ctrl+F)"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">search</span>
                    <span>Find</span>
                  </button>
                  <button
                    onClick={() => {
                      const findVal = prompt('Find text:');
                      if (findVal && editor) {
                        const repVal = prompt(`Replace "${findVal}" with:`) || '';
                        const html = editor.getHTML();
                        editor.commands.setContent(html.replaceAll(findVal, repVal));
                      }
                    }}
                    className="h-5 px-1.5 rounded flex items-center gap-1.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[11px]"
                    title="Replace (Ctrl+H)"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">find_replace</span>
                    <span>Replace</span>
                  </button>
                  <button
                    onClick={() => editor?.commands.selectAll()}
                    className="h-5 px-1.5 rounded flex items-center gap-1.5 text-[#3c4043] dark:text-[#c4c7c5] hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[11px]"
                    title="Select All"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">select_all</span>
                    <span>Select</span>
                  </button>
                </div>

                {/* Bottom Label */}
                <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Editing</span>
                  <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                </div>
              </div>

              {/* GROUP 6: ADD-INS */}
              <div className="flex flex-col justify-between px-1.5 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center justify-center flex-1 pt-0.5">
                  <button
                    onClick={() => setCurrentView('library')}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a] text-[#202124] dark:text-[#e4e7ec] transition-colors"
                    title="Research Add-ins"
                    type="button"
                  >
                    <div className="w-7 h-7 grid grid-cols-2 gap-0.5 p-1 mb-0.5">
                      <div className="bg-red-500 rounded-[1px]"></div>
                      <div className="bg-blue-500 rounded-[1px]"></div>
                      <div className="bg-green-500 rounded-[1px]"></div>
                      <div className="bg-amber-500 rounded-[1px]"></div>
                    </div>
                    <span className="font-medium text-[11px] leading-tight">Add-ins</span>
                  </button>
                </div>

                {/* Bottom Label */}
                <div className="text-center px-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Add-ins</span>
                </div>
              </div>

              {/* GROUP 7: GEMINI AI ASSISTANT FOR OFFICE */}
              <div className="flex flex-col justify-between px-2">
                <div className="flex items-center gap-1.5 flex-1 pt-0.5">
                  <div className="relative">
                    <button
                      onClick={() => setAssistantMenuOpen(!assistantMenuOpen)}
                      className="flex flex-col items-center justify-center px-2.5 py-1 rounded bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 transition-all shadow-xs"
                      title="Gemini AI for Office Assistant"
                      type="button"
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="material-symbols-outlined text-[19px] text-blue-600 dark:text-blue-400 animate-pulse">auto_awesome</span>
                        <span className="text-[10px] px-1 py-0.2 bg-blue-600 text-white rounded font-bold uppercase tracking-wider">⚡ Turbo</span>
                      </div>
                      <div className="flex items-center gap-0.5 font-semibold text-[11px]">
                        <span>Assistant</span>
                        <span className="material-symbols-outlined text-[13px]">arrow_drop_down</span>
                      </div>
                    </button>

                    {assistantMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#1a2133] rounded-lg shadow-2xl border border-blue-200 dark:border-blue-900/60 p-2 z-50 text-[11px]">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-blue-600">bolt</span>
                            <span className="font-semibold text-gray-900 dark:text-white">Gemini Fast Mode</span>
                          </div>
                          <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded font-medium text-[10px]">
                            Active
                          </span>
                        </div>

                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              toggleRightPanel();
                              setAssistantMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                          >
                            <span className="material-symbols-outlined text-[16px] text-primary">chat</span>
                            <div>
                              <div className="font-medium">Open AI Copilot Chat</div>
                              <div className="text-[10px] text-gray-500">Real-time streaming assistant</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              onAiAction('rewrite');
                              setAssistantMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                          >
                            <span className="material-symbols-outlined text-[16px] text-indigo-600">edit_note</span>
                            <div>
                              <div className="font-medium">Rewrite Selection with Rigor</div>
                              <div className="text-[10px] text-gray-500">Fast academic phrasing</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setCurrentView('originality');
                              setAssistantMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                          >
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                            <div>
                              <div className="font-medium">Run Originality Scan</div>
                              <div className="text-[10px] text-gray-500">Instant similarity verification</div>
                            </div>
                          </button>

                          <div className="pt-1.5 mt-1.5 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                              <span>Latency Preset</span>
                              <span className="text-primary font-semibold">{aiSpeedMode.toUpperCase()}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                onClick={() => setAiSpeedMode('turbo')}
                                className={`py-1 rounded text-center font-medium ${
                                  aiSpeedMode === 'turbo' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                ⚡ Turbo
                              </button>
                              <button
                                onClick={() => setAiSpeedMode('balanced')}
                                className={`py-1 rounded text-center font-medium ${
                                  aiSpeedMode === 'balanced' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                ⚖️ Balanced
                              </button>
                              <button
                                onClick={() => setAiSpeedMode('deep')}
                                className={`py-1 rounded text-center font-medium ${
                                  aiSpeedMode === 'deep' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                🧠 Deep
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Label matching screenshot */}
                <div className="text-center px-1 text-[10px] text-blue-700 dark:text-blue-300 font-semibold truncate max-w-[110px]">
                  <span>Gemini AI for Offi...</span>
                </div>
              </div>
            </div>
          )}

          {/* INSERT TAB RIBBON CONTENT */}
          {activeRibbonTab === 'insert' && (
            <div className="flex items-stretch h-full py-1 gap-2">
              <div className="flex flex-col justify-between px-2 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={() => editor?.chain().focus().setPageBreak().run()}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                    title="Insert Page Break (Ctrl+Enter)"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary">insert_page_break</span>
                    <span className="text-[11px] font-medium">Page Break</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Pages</div>
              </div>

              <div className="flex flex-col justify-between px-2 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={() => {
                      const cit = prompt('Enter academic citation (e.g. [Vaswani et al., 2017]):');
                      if (cit && editor) editor.chain().focus().insertContent(` ${cit} `).run();
                    }}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-indigo-600">format_quote</span>
                    <span className="text-[11px] font-medium">Citation</span>
                  </button>

                  <button
                    onClick={() => {
                      if (editor) {
                        editor.chain().focus().insertContent(' $\\mathcal{L}_{\\text{NSVP}} = \\alpha \\mathcal{L}_{\\text{Datalog}} + (1-\\alpha) \\mathcal{L}_{\\text{CrossEntropy}}$ ').run();
                      }
                    }}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-purple-600">functions</span>
                    <span className="text-[11px] font-medium">LaTeX Equation</span>
                  </button>

                  <button
                    onClick={() => toggleLeftPanel()}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-teal-600">menu_book</span>
                    <span className="text-[11px] font-medium">CrossRef Search</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Academic References</div>
              </div>

              <div className="flex flex-col justify-between px-2">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={() => {
                      const url = prompt('Enter Web Link or DOI URL:');
                      if (url && editor) editor.chain().focus().setLink({ href: url }).run();
                    }}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-blue-600">link</span>
                    <span className="text-[11px] font-medium">Hyperlink</span>
                  </button>
                  <button
                    onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                    className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-gray-600">horizontal_rule</span>
                    <span className="text-[11px] font-medium">Divider</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Structure</div>
              </div>
            </div>
          )}

          {/* REFERENCES TAB RIBBON CONTENT */}
          {activeRibbonTab === 'references' && (
            <div className="flex items-stretch h-full py-1 gap-2">
              <div className="flex flex-col justify-between px-2 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={() => {
                      const cit = prompt('Add Academic Citation (e.g. [LeCun et al., 2015]):');
                      if (cit && editor) editor.chain().focus().insertContent(` ${cit} `).run();
                    }}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary">bookmark_add</span>
                    <span className="text-[11px] font-medium">Insert Citation</span>
                  </button>
                  <button
                    onClick={() => toggleLeftPanel()}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-indigo-600">sync</span>
                    <span className="text-[11px] font-medium">Manage Sources</span>
                  </button>
                  <button
                    onClick={() => {
                      if (editor) {
                        const bib = `\n\n## References\n[1] A. Vaswani et al., "Attention is all you need," in NeurIPS, 2017.\n[2] Y. LeCun, Y. Bengio, and G. Hinton, "Deep learning," Nature, vol. 521, no. 7553, 2015.`;
                        editor.chain().focus().insertContent(bib).run();
                      }
                    }}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-teal-600">library_books</span>
                    <span className="text-[11px] font-medium">Bibliography</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Citations & Bibliography</div>
              </div>
            </div>
          )}

          {/* REVIEW TAB RIBBON CONTENT */}
          {activeRibbonTab === 'review' && (
            <div className="flex items-stretch h-full py-1 gap-2">
              <div className="flex flex-col justify-between px-2 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={() => setCurrentView('originality')}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>
                    <span className="text-[11px] font-medium">Originality (98%)</span>
                  </button>
                  <button
                    onClick={() => {
                      const text = editor?.getText() || '';
                      const words = text.split(/\s+/).filter(Boolean).length;
                      alert(`Manuscript Statistics:\n\n• Words: ${words.toLocaleString()}\n• Characters: ${text.length.toLocaleString()}\n• Reading Time: ~${Math.ceil(words / 220)} min`);
                    }}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-blue-600">analytics</span>
                    <span className="text-[11px] font-medium">Word Count</span>
                  </button>
                  <button
                    onClick={() => toggleRightPanel()}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-purple-600">auto_fix_high</span>
                    <span className="text-[11px] font-medium">AI Peer Review</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Scholarly Proofing & Verification</div>
              </div>
            </div>
          )}

          {/* VIEW TAB RIBBON CONTENT */}
          {activeRibbonTab === 'view' && (
            <div className="flex items-stretch h-full py-1 gap-2">
              <div className="flex flex-col justify-between px-2 border-r border-[#e0e2e6] dark:border-[#2b354e]">
                <div className="flex items-center gap-2 flex-1 pt-0.5">
                  <button
                    onClick={toggleLeftPanel}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary">dock_to_left</span>
                    <span className="text-[11px] font-medium">Research Desk</span>
                  </button>
                  <button
                    onClick={toggleRightPanel}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-indigo-600">dock_to_right</span>
                    <span className="text-[11px] font-medium">AI Copilot</span>
                  </button>
                  <button
                    onClick={toggleTheme}
                    className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-[#e6e8ec] dark:hover:bg-[#28334a]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-amber-500">
                      {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                    </span>
                    <span className="text-[11px] font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>
                <div className="text-center text-[10px] text-gray-500 font-medium">Panes & Themes</div>
              </div>
            </div>
          )}

          {/* Right Collapse Toggle */}
          <div className="flex items-center pl-2">
            <button
              onClick={toggleRibbonCollapsed}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={ribbonCollapsed ? 'Expand Ribbon (Ctrl+F1)' : 'Collapse Ribbon (Ctrl+F1)'}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {ribbonCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
