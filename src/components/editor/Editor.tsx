import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { PageBreak } from './extensions/PageBreak';
import { WorkspaceRibbon } from './WorkspaceRibbon';
import { useAppStore } from '../../store/useAppStore';
import { aiService } from '../../services/ai';

export const Editor: React.FC = () => {
  const { 
    activeDocumentId, 
    db, 
    updateDocumentContent, 
    pendingCitation, 
    clearPendingCitation, 
    undoTrigger, 
    redoTrigger,
    setCurrentView,
    setEditorInstance,
    triggerEditorTick,
    aiSpeedMode,
  } = useAppStore();

  const geminiKey = db.settings?.geminiKey || '';
  const activeDoc = db.documents.find(d => d.id === activeDocumentId);

  const [saveStatus, setSaveStatus] = useState<string>('Saved just now');
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [aiStreamingText, setAiStreamingText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [aiActionType, setAiActionType] = useState<string>('');
  const selectedRange = useRef<{ from: number; to: number } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const isPaginating = useRef(false);
  const paginationTimeout = useRef<any>(null);

  const updatePageInfo = useCallback((ed: any) => {
    try {
      if (!ed || !ed.state) return;
      const { doc, selection } = ed.state;
      let totalBreaks = 0;
      let breaksBeforeCursor = 0;
      const cursorPos = selection?.from ?? 0;

      doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'pageBreak') {
          totalBreaks++;
          if (pos < cursorPos) {
            breaksBeforeCursor++;
          }
        }
      });

      setTotalPages(Math.max(1, totalBreaks + 1));
      setCurrentPage(Math.max(1, breaksBeforeCursor + 1));
    } catch {
      // Ignore if editor state not ready
    }
  }, []);

  const checkAutoPagination = useCallback((ed: any) => {
    if (!ed || isPaginating.current) return;

    if (paginationTimeout.current) {
      clearTimeout(paginationTimeout.current);
    }

    paginationTimeout.current = setTimeout(() => {
      const editorDom = ed.view?.dom as HTMLElement;
      if (!editorDom) return;

      const children = Array.from(editorDom.children) as HTMLElement[];
      if (children.length < 2) return;

      // Available content height in px before breaking to next page (~A4 height minus margins)
      const PAGE_CONTENT_HEIGHT = 920;

      let pageStartY = children[0].offsetTop;
      let targetNode: HTMLElement | null = null;

      for (let i = 0; i < children.length; i++) {
        const el = children[i];

        if (
          el.getAttribute('data-type') === 'page-break' ||
          el.classList.contains('paper-page-break')
        ) {
          pageStartY = el.offsetTop + el.offsetHeight;
          continue;
        }

        const elBottom = el.offsetTop + el.offsetHeight;
        const currentHeightOnPage = elBottom - pageStartY;

        if (currentHeightOnPage > PAGE_CONTENT_HEIGHT) {
          const isFirstOnPage = (el.offsetTop - pageStartY) < 40;
          const prev = el.previousElementSibling;
          const isPrevBreak =
            prev &&
            (prev.getAttribute('data-type') === 'page-break' ||
              prev.classList.contains('paper-page-break'));

          if (!isFirstOnPage && !isPrevBreak) {
            targetNode = el;
            break;
          }
        }
      }

      if (targetNode) {
        try {
          isPaginating.current = true;
          const pos = ed.view.posAtDOM(targetNode, 0);
          if (typeof pos === 'number' && pos >= 0) {
            ed.chain().focus().insertContentAt(pos, { type: 'pageBreak' }).run();
          }
        } catch (err) {
          console.warn('Auto-pagination could not insert page break:', err);
        } finally {
          setTimeout(() => {
            isPaginating.current = false;
            updatePageInfo(ed);
          }, 150);
        }
      }
    }, 250);
  }, [updatePageInfo]);

  const handleExport = (format: 'md' | 'html' | 'txt' | 'tex') => {
    if (!activeDoc) return;
    let content = activeDoc.content;
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'html') {
      mime = 'text/html';
      ext = 'html';
    } else if (format === 'md') {
      content = content
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<[^>]+>/g, '');
      mime = 'text/markdown';
      ext = 'md';
    } else if (format === 'tex') {
      const plain = activeDoc.content.replace(/<[^>]+>/g, ' ');
      content = `% Generated by PaperPilot\n\\documentclass{article}\n\\begin{document}\n\\title{${activeDoc.title}}\n\\maketitle\n${plain}\n\\end{document}`;
      mime = 'application/x-tex';
      ext = 'tex';
    } else if (format === 'txt') {
      content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      ext = 'txt';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\.[^/.]+$/, "")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: 'Begin typing your scholarly manuscript or paper according to template guidelines...',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Typography,
      PageBreak,
    ],
    content: activeDoc?.content || '',
    onUpdate: ({ editor }) => {
      setSaveStatus('Saving...');
      const html = editor.getHTML();
      const text = editor.getText();
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

      triggerEditorTick();
      checkAutoPagination(editor);
      updatePageInfo(editor);

      if (activeDocumentId) {
        updateDocumentContent(activeDocumentId, html, wordCount)
          .then(() => setSaveStatus('Saved'))
          .catch((error: unknown) => {
            console.error('Document autosave failed:', error);
            setSaveStatus('Save failed');
          });
      }
    },
    onSelectionUpdate: ({ editor }) => {
      triggerEditorTick();
      updatePageInfo(editor);
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text.trim().length > 3) {
          setSelectedText(text);
          selectedRange.current = { from, to };
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const rect = domSelection.getRangeAt(0).getBoundingClientRect();
            // Clamp position to viewport bounds
            const x = Math.max(20, Math.min(rect.left, window.innerWidth - 380));
            const y = Math.max(100, rect.top - 48);
            setFloatingMenuPos({ x, y });
            return;
          }
        }
      }
      if (!isAiGenerating && !showAiResultModal) {
        setFloatingMenuPos(null);
        setSelectedText('');
        selectedRange.current = null;
      }
    }
  });

  // Register editor instance with global store
  useEffect(() => {
    if (editor) {
      setEditorInstance(editor);
      checkAutoPagination(editor);
      updatePageInfo(editor);
    }
    return () => setEditorInstance(null);
  }, [editor, setEditorInstance, checkAutoPagination, updatePageInfo]);

  // Sync document content if switching active document
  useEffect(() => {
    if (editor && activeDoc && editor.getHTML() !== activeDoc.content) {
      editor.commands.setContent(activeDoc.content);
      setTimeout(() => {
        checkAutoPagination(editor);
        updatePageInfo(editor);
      }, 100);
    }
  }, [activeDocumentId, editor, checkAutoPagination, updatePageInfo]);

  // Insert citation when user clicks "Cite +" on research desk
  useEffect(() => {
    if (editor && pendingCitation) {
      editor.chain().focus().insertContent(` ${pendingCitation} `).run();
      clearPendingCitation();
    }
  }, [pendingCitation, editor, clearPendingCitation]);

  // Undo / Redo triggers from header
  useEffect(() => {
    if (editor && undoTrigger > 0) {
      editor.chain().focus().undo().run();
    }
  }, [undoTrigger, editor]);

  useEffect(() => {
    if (editor && redoTrigger > 0) {
      editor.chain().focus().redo().run();
    }
  }, [redoTrigger, editor]);

  // --- AI Actions ---
  const handleAiAction = async (action: 'rewrite' | 'sources' | 'summarize') => {
    if (!selectedText || !editor) return;

    if (!geminiKey) {
      alert('Please enter your Gemini API Key in Settings to use AI features.');
      return;
    }

    setIsAiGenerating(true);
    setShowAiResultModal(true);
    setAiActionType(action);
    setAiStreamingText('Connecting to Gemini...');

    let prompt = '';
    if (action === 'rewrite') {
      prompt = `Improve the academic rigor, formal phrasing, and clarity of the following scholarly excerpt while strictly preserving factual meaning and citation claims:\n\n"${selectedText}"`;
    } else if (action === 'sources') {
      prompt = `Analyze this scholarly claim and recommend 2-3 specific citations or literature frameworks to support it:\n\n"${selectedText}"`;
    } else if (action === 'summarize') {
      prompt = `Provide a concise 1-sentence academic abstract summary of this passage:\n\n"${selectedText}"`;
    }

    try {
      await aiService.streamChatMessage(
        geminiKey,
        [],
        prompt,
        (chunk) => {
          setAiStreamingText(chunk);
        },
        activeDoc ? { title: activeDoc.title, content: activeDoc.content } : undefined,
        db.settings?.activeModel,
        aiSpeedMode || 'turbo'
      );
    } catch (e: any) {
      setAiStreamingText(`⚠️ AI Generation failed: ${e.message || String(e)}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const applyAiRewrite = () => {
    if (editor && aiStreamingText && !aiStreamingText.startsWith('⚠️')) {
      const range = selectedRange.current;
      if (range) {
        editor.chain().focus().insertContentAt(range, aiStreamingText).run();
      }
      setShowAiResultModal(false);
      setFloatingMenuPos(null);
      setSelectedText('');
      selectedRange.current = null;
    }
  };

  const currentText = editor?.getText() || '';
  const words = currentText.split(/\s+/).filter(Boolean).length;
  const chars = currentText.length;
  const readingTime = Math.max(1, Math.ceil(words / 220));

  // Empty state when no document is selected
  if (!activeDoc) {
    return (
      <section className="flex-1 h-full flex flex-col items-center justify-center bg-surface-container-low text-center p-8">
        <span className="material-symbols-outlined text-[48px] text-outline mb-4">edit_document</span>
        <h2 className="text-lg font-semibold text-on-surface mb-2">No Document Selected</h2>
        <p className="text-sm text-on-surface-variant mb-6 max-w-md">
          Open a project from the Projects Library or create a new document section from the sidebar to start writing.
        </p>
        <button
          onClick={() => setCurrentView('library')}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          Open Projects Library
        </button>
      </section>
    );
  }

  return (
    <section className="flex-1 h-full flex flex-col bg-surface-container-low overflow-hidden relative select-text">
      {/* Microsoft Word Workspace Top Ribbon Toolbar */}
      <WorkspaceRibbon 
        editor={editor}
        onExport={handleExport}
        onAiAction={handleAiAction}
      />

      {/* Floating AI Selection Menu Popover */}
      {floatingMenuPos && (
        <div 
          style={{ position: 'fixed', left: `${floatingMenuPos.x}px`, top: `${floatingMenuPos.y}px` }}
          className="z-50 glass-panel shadow-xl rounded-lg px-2 py-1.5 flex items-center gap-1.5 animate-scale-in select-none text-xs"
        >
          <div className="flex items-center gap-1 pr-1.5 border-r border-outline-variant">
            <span className="material-symbols-outlined text-[13px] text-primary animate-pulse">auto_awesome</span>
            <span className="font-semibold text-primary text-[10px]">AI</span>
          </div>

          <button 
            onClick={() => handleAiAction('rewrite')}
            disabled={isAiGenerating}
            className="px-2 py-0.5 rounded bg-primary hover:bg-primary-container text-white font-medium text-[11px] flex items-center gap-1 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span>{isAiGenerating ? 'Working...' : 'Rewrite'}</span>
          </button>

          <button 
            onClick={() => handleAiAction('sources')}
            disabled={isAiGenerating}
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[12px] text-primary">link</span>
            <span>Sources</span>
          </button>

          <button 
            onClick={() => handleAiAction('summarize')}
            disabled={isAiGenerating}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant" 
            title="Summarize Selection"
          >
            <span className="material-symbols-outlined text-[13px]">summarize</span>
          </button>

          <button 
            onClick={() => setCurrentView('originality')}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant" 
            title="Check Originality"
          >
            <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
          </button>
        </div>
      )}

      {/* AI Result Preview Modal */}
      {showAiResultModal && (
        <div className="absolute top-3 right-6 z-50 w-96 glass-panel rounded-xl shadow-2xl p-4 animate-scale-in select-text">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary animate-pulse">auto_awesome</span>
              <span className="font-semibold text-on-surface text-xs">
                {aiActionType === 'rewrite' ? 'Academic Rewrite' : aiActionType === 'sources' ? 'Recommended Citations' : 'Passage Summary'}
              </span>
            </div>
            <button
              onClick={() => { setShowAiResultModal(false); setFloatingMenuPos(null); }}
              className="text-on-surface-variant hover:text-on-surface rounded p-0.5 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto text-xs text-on-surface leading-relaxed font-serif bg-surface-container-low p-3 rounded-md border border-outline-variant whitespace-pre-wrap">
            {aiStreamingText}
            {isAiGenerating && (
              <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse rounded-sm"></span>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant text-xs">
            <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot"></span>
              <span>{db.settings?.activeModel || 'gemini-2.0-flash'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAiResultModal(false)}
                className="px-2.5 py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-medium transition-colors"
              >
                Close
              </button>
              {aiActionType === 'rewrite' && (
                <button
                  onClick={applyAiRewrite}
                  disabled={isAiGenerating}
                  className="px-3 py-1 rounded bg-primary hover:bg-primary-container text-white text-xs font-medium flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">check</span>
                  <span>Replace Text</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Ruler */}
      <div className="h-4 bg-surface-container-lowest border-b border-outline-variant flex justify-center items-center select-none text-[8px] text-outline font-mono tracking-widest">
        <div className="w-full max-w-[780px] flex justify-between px-6 sm:px-10 lg:px-16">
          <span>|···1···|···2···|···3···|···4···|···5···|···6···|···7···|</span>
        </div>
      </div>

      {/* Editor Canvas Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center bg-surface-container relative">
        {/* Physical Paper Sheet */}
        <div className="w-full max-w-[800px] min-h-[1056px] bg-surface-container-lowest paper-sheet rounded px-6 sm:px-12 py-10 sm:py-14 relative border border-outline-variant overflow-hidden shadow-md">
          <div className="prose max-w-none text-on-surface font-body-paper text-body-paper leading-relaxed">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Bottom Editor Status Bar */}
      <footer className="min-h-6 px-2 sm:px-4 py-1 bg-surface-container-lowest shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-label-sm text-[11px] text-on-surface-variant z-20 border-t border-outline-variant select-none">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="flex items-center gap-1 font-medium text-on-surface">
            <span className="material-symbols-outlined text-[13px] text-primary">description</span>
            <span>Page {currentPage} of {totalPages}</span>
          </span>
          <span className="hidden lg:inline text-outline-variant">•</span>
          <span className="hidden lg:flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="material-symbols-outlined text-[13px]">spellcheck</span>
            <span>Proofing active</span>
          </span>
          <span className="hidden xl:inline text-outline-variant">•</span>
          <button 
            onClick={() => setCurrentView('originality')}
            className="hidden xl:flex items-center gap-1 text-primary font-medium hover:underline"
          >
            <span className="material-symbols-outlined text-[13px]">verified</span>
            <span>Originality report</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] min-w-0">
          <span className="whitespace-nowrap">
            {words.toLocaleString()} words<span className="hidden sm:inline"> · {chars.toLocaleString()} chars · ~{readingTime} min</span>
          </span>
          <span className="hidden sm:inline text-outline-variant">•</span>
          <span
            role="status"
            className={`flex items-center gap-1 font-sans font-medium ${
              saveStatus === 'Save failed'
                ? 'text-error'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'Save failed' ? 'bg-error' : 'bg-emerald-500'}`}></span>
            <span>{saveStatus}</span>
          </span>
        </div>
      </footer>
    </section>
  );
};
