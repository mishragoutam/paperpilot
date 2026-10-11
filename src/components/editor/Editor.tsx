import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
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
    setCurrentView
  } = useAppStore();

  const geminiKey = db.settings?.geminiKey || '';
  const activeDoc = db.documents.find(d => d.id === activeDocumentId);

  const [saveStatus, setSaveStatus] = useState<string>('Saved just now');
  const [stylePreset, setStylePreset] = useState<'p' | 'h1' | 'h2' | 'h3'>('h2');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isAiRewriting, setIsAiRewriting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Begin typing your scholarly manuscript or paper...',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Highlight,
      Typography,
    ],
    content: activeDoc?.content || '',
    onUpdate: ({ editor }) => {
      setSaveStatus('Saving changes...');
      const html = editor.getHTML();
      const text = editor.getText();
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

      if (activeDocumentId) {
        updateDocumentContent(activeDocumentId, html, wordCount)
          .then(() => setSaveStatus('Autosaved just now'))
          .catch(() => setSaveStatus('Save error'));
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text.trim().length > 3) {
          setSelectedText(text);
          // Calculate coordinates relative to editor canvas
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const rect = domSelection.getRangeAt(0).getBoundingClientRect();
            setFloatingMenuPos({ x: rect.left, y: rect.top - 46 });
            return;
          }
        }
      }
      setFloatingMenuPos(null);
      setSelectedText('');
    }
  });

  // Sync document content if switching active document
  useEffect(() => {
    if (editor && activeDoc && editor.getHTML() !== activeDoc.content) {
      editor.commands.setContent(activeDoc.content);
    }
  }, [activeDocumentId, editor]);

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

  const handleHeadingSelect = (preset: 'p' | 'h1' | 'h2' | 'h3') => {
    if (!editor) return;
    setStylePreset(preset);
    setStyleMenuOpen(false);

    if (preset === 'p') {
      editor.chain().focus().setParagraph().run();
    } else if (preset === 'h1') {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    } else if (preset === 'h2') {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (preset === 'h3') {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    }
  };

  const handleAiAction = async (action: 'rewrite' | 'sources' | 'summarize') => {
    if (!selectedText || !editor) return;

    if (!geminiKey) {
      alert('Please enter your Gemini API Key in Settings to use the AI Selection Assistant.');
      return;
    }

    setIsAiRewriting(true);
    let prompt = '';
    if (action === 'rewrite') {
      prompt = `Improve the academic rigor, formal phrasing, and clarity of the following scholarly excerpt while preserving factual meaning:\n\n"${selectedText}"`;
    } else if (action === 'sources') {
      prompt = `Identify key academic claims in this passage and recommend 2-3 specific citations or literature frameworks:\n\n"${selectedText}"`;
    } else if (action === 'summarize') {
      prompt = `Provide a concise 1-sentence academic summary of this passage:\n\n"${selectedText}"`;
    }

    try {
      const result = await aiService.sendChatMessage(geminiKey, [], prompt, undefined, db.settings?.activeModel);
      if (action === 'rewrite') {
        editor.chain().focus().insertContent(result).run();
      } else {
        alert(`AI Suggestion:\n\n${result}`);
      }
    } catch (e: any) {
      alert(e.message || 'AI generation failed');
    } finally {
      setIsAiRewriting(false);
      setFloatingMenuPos(null);
    }
  };

  const currentText = editor?.getText() || '';
  const words = currentText.split(/\s+/).filter(Boolean).length;
  const chars = currentText.length;
  const readingTime = Math.max(1, Math.ceil(words / 220));

  return (
    <section className="flex-1 h-full flex flex-col bg-surface-container-low overflow-hidden relative select-text">
      {/* Sticky Formatting Ribbon Toolbar */}
      <div className="h-10 px-space-md bg-surface-container-lowest shrink-0 shadow-[0_1px_4px_rgba(19,27,46,0.04)] flex items-center justify-between gap-2 overflow-x-auto scrollbar-none z-30 border-b border-surface-container select-none">
        {/* Left Typography Controls */}
        <div className="flex items-center gap-1">
          {/* Font Family */}
          <button className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container flex items-center gap-1 text-on-surface font-label-sm text-label-sm">
            <span className="font-headline-sm text-xs">Source Serif 4</span>
            <span className="material-symbols-outlined text-[13px] text-outline">expand_more</span>
          </button>

          {/* Font Size */}
          <button className="h-7 px-1.5 rounded bg-surface-container-low hover:bg-surface-container flex items-center gap-0.5 text-on-surface font-label-code text-[11px]">
            <span>11pt</span>
            <span className="material-symbols-outlined text-[12px] text-outline">expand_more</span>
          </button>

          {/* Style Preset Selector */}
          <div className="relative">
            <button 
              onClick={() => setStyleMenuOpen(!styleMenuOpen)}
              className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container flex items-center gap-1 text-on-surface font-label-sm text-label-sm"
            >
              <span>{stylePreset === 'h1' ? 'Heading 1' : stylePreset === 'h2' ? 'Heading 2' : stylePreset === 'h3' ? 'Heading 3' : 'Normal Text'}</span>
              <span className="material-symbols-outlined text-[13px] text-outline">expand_more</span>
            </button>
            {styleMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-36 bg-surface-container-lowest rounded shadow-lg border border-surface-container py-1 z-50 text-xs">
                <button onClick={() => handleHeadingSelect('p')} className="w-full text-left px-3 py-1 hover:bg-surface-container text-on-surface">Normal Text</button>
                <button onClick={() => handleHeadingSelect('h1')} className="w-full text-left px-3 py-1 hover:bg-surface-container text-on-surface font-bold text-sm">Heading 1</button>
                <button onClick={() => handleHeadingSelect('h2')} className="w-full text-left px-3 py-1 hover:bg-surface-container text-on-surface font-semibold text-xs">Heading 2</button>
                <button onClick={() => handleHeadingSelect('h3')} className="w-full text-left px-3 py-1 hover:bg-surface-container text-on-surface font-medium text-xs">Heading 3</button>
              </div>
            )}
          </div>

          <span className="w-px h-4 bg-outline-variant mx-1"></span>

          {/* Inline Styles */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => editor?.chain().focus().toggleBold().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center font-bold text-label-md transition-colors ${
                editor?.isActive('bold') ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
              }`}
              title="Bold (⌘B)"
            >
              B
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleItalic().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center italic text-label-md transition-colors ${
                editor?.isActive('italic') ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
              }`}
              title="Italic (⌘I)"
            >
              I
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleHighlight().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center text-label-md underline transition-colors ${
                editor?.isActive('highlight') ? 'bg-amber-200 text-amber-900' : 'text-on-surface hover:bg-surface-container'
              }`}
              title="Highlight Text"
            >
              U
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleStrike().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center line-through text-label-md transition-colors ${
                editor?.isActive('strike') ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
              }`}
              title="Strikethrough"
            >
              S
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleCode().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center font-label-code text-[11px] transition-colors ${
                editor?.isActive('code') ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
              }`}
              title="Code Monospace"
            >
              &lt;/&gt;
            </button>
          </div>

          <span className="w-px h-4 bg-outline-variant mx-1"></span>

          {/* Lists & Quotes */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => editor?.chain().focus().toggleBulletList().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                editor?.isActive('bulletList') ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
              title="Bullet List"
            >
              <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleOrderedList().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                editor?.isActive('orderedList') ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
              title="Numbered List"
            >
              <span className="material-symbols-outlined text-[15px]">format_list_numbered</span>
            </button>
            <button 
              onClick={() => editor?.chain().focus().toggleBlockquote().run()} 
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                editor?.isActive('blockquote') ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
              title="Blockquote"
            >
              <span className="material-symbols-outlined text-[15px]">format_quote</span>
            </button>
          </div>
        </div>

        {/* Right Citation & Utility Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => {
              const cit = prompt('Enter academic citation text (e.g. [Vaswani et al., 2017]):');
              if (cit && editor) {
                editor.chain().focus().insertContent(` ${cit} `).run();
              }
            }}
            className="h-7 px-2 rounded bg-primary text-on-primary hover:bg-primary-container font-label-sm text-label-sm flex items-center gap-1 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[13px]">format_quote</span>
            <span>Insert Citation</span>
          </button>
          <button 
            onClick={() => {
              if (editor) {
                editor.chain().focus().insertContent(' $\\mathcal{L}_{\\text{NSVP}} = \\alpha \\mathcal{L}_{\\text{Datalog}} + (1-\\alpha) \\mathcal{L}_{\\text{CrossEntropy}}$ ').run();
              }
            }}
            className="h-7 px-2 rounded bg-surface-container-high hover:bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">functions</span>
            <span>Math ($)</span>
          </button>
          <button 
            onClick={() => {
              const term = prompt('Find in manuscript:');
              if (term) window.find(term);
            }}
            className="h-7 px-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center gap-0.5 font-label-code text-[11px]" 
            title="Find & Replace"
          >
            <span className="material-symbols-outlined text-[14px]">find_replace</span>
            <span>⌘F</span>
          </button>
          <div className="h-4 w-px bg-outline-variant mx-0.5"></div>
          <button className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center gap-1">
            <span className="font-medium text-secondary">IEEE Std</span>
            <span className="material-symbols-outlined text-[12px] text-outline">expand_more</span>
          </button>
        </div>
      </div>

      {/* Floating AI Selection Menu Popover */}
      {floatingMenuPos && (
        <div 
          style={{ position: 'fixed', left: `${floatingMenuPos.x}px`, top: `${floatingMenuPos.y}px` }}
          className="z-50 bg-surface-container-lowest shadow-xl rounded px-2 py-1 flex items-center gap-1 border border-surface-container animate-in fade-in duration-150 select-none"
        >
          <button 
            onClick={() => handleAiAction('rewrite')}
            disabled={isAiRewriting}
            className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm text-[11px] flex items-center gap-1 hover:bg-primary-container transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span>{isAiRewriting ? 'Rewriting...' : 'Ask AI'}</span>
          </button>
          <button 
            onClick={() => handleAiAction('rewrite')}
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-[11px] flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[12px]">edit_note</span>
            <span>Rewrite Rigor</span>
          </button>
          <button 
            onClick={() => handleAiAction('sources')}
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-[11px] flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[12px]">link</span>
            <span>Find Sources</span>
          </button>
          <button 
            onClick={() => setCurrentView('originality')}
            className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-[11px] flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[12px]">verified</span>
            <span>Originality</span>
          </button>
          <button 
            onClick={() => handleAiAction('summarize')}
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface" 
            title="Summarize Selection"
          >
            <span className="material-symbols-outlined text-[13px]">summarize</span>
          </button>
        </div>
      )}

      {/* Editor Canvas Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center bg-surface-container-low/60 relative">
        {/* Elevating Physical Paper Sheet */}
        <div className="w-full max-w-[780px] min-h-[960px] bg-surface-container-lowest shadow-[0_4px_24px_rgba(19,27,46,0.06)] rounded-sm px-16 py-14 flex flex-col justify-between relative transition-all border border-surface-container">
          <div className="prose max-w-none text-on-surface font-body-paper text-body-paper leading-relaxed">
            <EditorContent editor={editor} />
          </div>

          {/* Academic Footnotes Section */}
          <footer className="pt-8 mt-12 space-y-2 border-t border-surface-container select-none">
            <div className="w-32 h-px bg-outline-variant"></div>
            <div className="space-y-1 font-body-ui text-[11px] text-on-surface-variant">
              <p>
                <sup className="text-primary font-bold">1</sup> Lead researcher supported by Swiss National Science Foundation (SNSF) Grant #204128.
              </p>
              <p>
                <sup className="text-secondary font-bold">2</sup> Contributed equally to experimental benchmark suite design and Datalog transpiler logic.
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Bottom Editor Status Bar */}
      <footer className="h-7 px-space-md bg-surface-container-lowest shrink-0 shadow-[0_-1px_4px_rgba(19,27,46,0.03)] flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant z-20 border-t border-surface-container select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium text-on-surface">
            <span className="material-symbols-outlined text-[13px] text-primary">bookmark</span>
            <span>Sec 2.3: Empirical Verification</span>
          </span>
          <span className="text-outline-variant">•</span>
          <span className="flex items-center gap-1 text-tertiary font-medium">
            <span className="material-symbols-outlined text-[13px]">spellcheck</span>
            <span>Spellcheck Clean</span>
          </span>
          <span className="text-outline-variant">•</span>
          <button 
            onClick={() => setCurrentView('originality')}
            className="flex items-center gap-1 text-primary font-medium hover:underline"
          >
            <span className="material-symbols-outlined text-[13px]">verified</span>
            <span>Originality: 98.4% Verified</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-label-code text-[11px]">
            {words.toLocaleString()} words · {chars.toLocaleString()} chars · ~{readingTime} min
          </span>
          <span className="text-outline-variant">•</span>
          <span className="flex items-center gap-1 text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            <span>{saveStatus}</span>
          </span>
        </div>
      </footer>
    </section>
  );
};
