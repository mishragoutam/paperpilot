import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      { tag: 'div.paper-page-break' },
      { tag: 'hr.page-break' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        class: 'paper-page-break',
      }),
      [
        'div',
        { class: 'page-break-container' },
        ['div', { class: 'page-break-line' }],
        [
          'div',
          { class: 'page-break-pill' },
          ['span', { class: 'page-break-icon' }, '📄'],
          ['span', { class: 'page-break-text' }, 'PAGE BREAK'],
          ['span', { class: 'page-break-hint' }, '(Next Page)'],
        ],
        ['div', { class: 'page-break-line' }],
      ],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name })
            .insertContent({ type: 'paragraph' })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
