import React, { useState } from 'react';
import { type Editor as TiptapEditor } from '@tiptap/react';
import { useAppStore } from '../../store/useAppStore';

interface WorkspaceRibbonProps {
  editor: TiptapEditor | null;
  onExport: (format: 'md' | 'html' | 'txt' | 'tex') => void;
  onAiAction: (action: 'rewrite' | 'sources' | 'summarize') => void;
}

const Divider = () => <div className="w-px h-5 bg-outline-variant mx-1 shrink-0" />;

const ToolBtn: React.FC<{
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  icon: string;
  label?: string;
}> = ({ active, disabled, onClick, title, icon, label }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-all shrink-0 ${
      active
        ? 'bg-primary/15 text-primary font-medium'
        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    <span className="material-symbols-outlined text-[16px]">{icon}</span>
    {label && <span className="hidden xl:block">{label}</span>}
  </button>
);

export const WorkspaceRibbon: React.FC<WorkspaceRibbonProps> = ({ editor, onExport, onAiAction }) => {
  const { db, activeDocumentId } = useAppStore();
  const [headingOpen, setHeadingOpen] = useState(false);

  const geminiKey = db.settings?.geminiKey || '';

  const isBold = editor?.isActive('bold') || false;
  const isItalic = editor?.isActive('italic') || false;
  const isUnderline = editor?.isActive('underline') || false;
  const isStrike = editor?.isActive('strike') || false;
  const isBullet = editor?.isActive('bulletList') || false;
  const isOrdered = editor?.isActive('orderedList') || false;
  const isAlignLeft = editor?.isActive({ textAlign: 'left' }) || (!editor?.isActive({ textAlign: 'center' }) && !editor?.isActive({ textAlign: 'right' }) && !editor?.isActive({ textAlign: 'justify' }));
  const isAlignCenter = editor?.isActive({ textAlign: 'center' }) || false;
  const isAlignRight = editor?.isActive({ textAlign: 'right' }) || false;
  const isAlignJustify = editor?.isActive({ textAlign: 'justify' }) || false;
  const isH1 = editor?.isActive('heading', { level: 1 }) || false;
  const isH2 = editor?.isActive('heading', { level: 2 }) || false;
  const isH3 = editor?.isActive('heading', { level: 3 }) || false;

  const currentHeadingLabel = isH1 ? 'H1' : isH2 ? 'H2' : isH3 ? 'H3' : 'P';

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-surface-container-lowest border-b border-surface-container overflow-x-auto scrollbar-none shrink-0">

      {/* Heading selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setHeadingOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors min-w-[48px]"
          title="Text style"
        >
          <span className="font-mono">{currentHeadingLabel}</span>
          <span className="material-symbols-outlined text-[12px]">expand_more</span>
        </button>
        {headingOpen && (
          <div className="absolute left-0 top-full mt-0.5 w-40 bg-surface-container-lowest rounded-lg shadow-lg border border-surface-container py-1 z-50 animate-scale-in">
            {[
              { label: 'Paragraph', action: () => editor?.chain().focus().setParagraph().run() },
              { label: 'Heading 1', action: () => editor?.chain().focus().setHeading({ level: 1 }).run() },
              { label: 'Heading 2', action: () => editor?.chain().focus().setHeading({ level: 2 }).run() },
              { label: 'Heading 3', action: () => editor?.chain().focus().setHeading({ level: 3 }).run() },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { item.action(); setHeadingOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container text-on-surface transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Basic formatting */}
      <ToolBtn active={isBold} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)" icon="format_bold" />
      <ToolBtn active={isItalic} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)" icon="format_italic" />
      <ToolBtn active={isUnderline} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)" icon="format_underlined" />
      <ToolBtn active={isStrike} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough" icon="strikethrough_s" />

      <Divider />

      {/* Alignment */}
      <ToolBtn active={isAlignLeft} onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="Align Left" icon="format_align_left" />
      <ToolBtn active={isAlignCenter} onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="Align Center" icon="format_align_center" />
      <ToolBtn active={isAlignRight} onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="Align Right" icon="format_align_right" />
      <ToolBtn active={isAlignJustify} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} title="Justify" icon="format_align_justify" />

      <Divider />

      {/* Lists */}
      <ToolBtn active={isBullet} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet List" icon="format_list_bulleted" />
      <ToolBtn active={isOrdered} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered List" icon="format_list_numbered" />

      <Divider />

      {/* Structure */}
      <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Blockquote" icon="format_quote" active={editor?.isActive('blockquote') || false} />
      <ToolBtn onClick={() => editor?.chain().focus().toggleCode().run()} title="Inline Code" icon="code" active={editor?.isActive('code') || false} />
      <ToolBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal Rule" icon="horizontal_rule" />
      <ToolBtn
        onClick={() => (editor as any)?.chain().focus().setPageBreak().run()}
        title="Insert New Page / Page Break (Ctrl+Enter)"
        icon="insert_page_break"
        label="New Page"
      />

      <Divider />

      {/* History */}
      <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo (Ctrl+Z)" icon="undo" disabled={!editor?.can().undo()} />
      <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo (Ctrl+Y)" icon="redo" disabled={!editor?.can().redo()} />

      <Divider />

      {/* AI actions */}
      {geminiKey && (
        <>
          <ToolBtn
            onClick={() => onAiAction('rewrite')}
            title="AI Rewrite"
            icon="auto_awesome"
            label="Rewrite"
          />
          <ToolBtn
            onClick={() => onAiAction('summarize')}
            title="AI Summarize"
            icon="summarize"
            label="Summarize"
          />
        </>
      )}
    </div>
  );
};
