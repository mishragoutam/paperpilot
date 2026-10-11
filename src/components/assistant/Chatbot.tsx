import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { aiService, type ChatMessage } from '../../services/ai';

interface ExtendedMessage extends ChatMessage {
  time?: string;
  evidence?: {
    doi: string;
    snippet: string;
    match: string;
  };
  suggestions?: string[];
}

export const Chatbot: React.FC = () => {
  const { db, activeDocumentId, setCurrentView } = useAppStore();
  const geminiKey = db.settings?.geminiKey || '';
  const activeDoc = db.documents.find(d => d.id === activeDocumentId);

  const [messages, setMessages] = useState<ExtendedMessage[]>([
    {
      role: 'assistant',
      time: '14:29',
      content: 'Both works tackle grounding divergence in academic compilation, but prioritize distinct architectural layers:\n\n1. Empirical Verification (Chen, 2024): Implements dynamic dual-channel graph indexing, rejecting assertions if citation subgraphs lack bidirectional edge alignment. Lowers hallucinated assertions by 41%.\n\n2. Formal Proof Chains (Valdivia, 2023): Embeds Datalog horn-clause predicates directly inside self-attention decoding. Guarantees logical soundness, but introduces a 120ms token latency overhead.',
      evidence: {
        doi: '10.48550/arXiv.2409.11894',
        snippet: '"Without symbol-level back-propagation, purely statistical cross-attention fails 23% of multi-hop paper verifications."',
        match: 'Verified Match'
      },
      suggestions: [
        'Draft synthesis paragraph for Section 2.4',
        'Find counterarguments to Datalog scalability',
        'Generate BibTeX for Chen (2024)'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachPaper, setAttachPaper] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || loading) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!geminiKey) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: textToSend, time },
        {
          role: 'assistant',
          time,
          content: '⚠️ No Gemini API Key configured.\n\nPlease open the Settings tab and paste your Google Gemini API key to activate AI assistance.',
          suggestions: ['Open Settings to configure API Key']
        }
      ]);
      setInput('');
      return;
    }

    const updated: ExtendedMessage[] = [...messages, { role: 'user', content: textToSend, time }];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const docContext = (attachPaper && activeDoc) 
        ? { title: activeDoc.title, content: activeDoc.content }
        : undefined;

      const reply = await aiService.sendChatMessage(
        geminiKey,
        messages.map(m => ({ role: m.role, content: m.content })),
        textToSend,
        docContext,
        db.settings?.activeModel
      );

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: reply,
          suggestions: [
            'Synthesize another literature angle',
            'Find empirical counterarguments',
            'Generate formal citation snippet'
          ]
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `Error: ${err.message || 'Failed to generate response'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-[340px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[-1px_0_12px_rgba(19,27,46,0.03)] z-20 border-l border-surface-container select-none">
      {/* Assistant Header */}
      <div className="px-space-md py-space-sm bg-surface-container-low/70 flex flex-col gap-1.5 shrink-0 border-b border-surface-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[17px] text-primary">smart_toy</span>
            <span className="font-label-md text-label-md font-semibold text-on-surface">Research Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 text-[10px] font-label-sm text-tertiary bg-tertiary-fixed px-1.5 py-0.5 rounded">
              <span className={`w-1.5 h-1.5 rounded-full ${geminiKey ? 'bg-tertiary animate-ping' : 'bg-amber-500'}`}></span>
              <span>{geminiKey ? 'Web Connected' : 'Key Needed'}</span>
            </span>
            <button 
              onClick={() => setCurrentView('settings')}
              className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" 
              title="Assistant Settings"
            >
              <span className="material-symbols-outlined text-[14px]">tune</span>
            </button>
          </div>
        </div>

        {/* Active Target Indicator */}
        <div className="flex items-center justify-between px-2 py-1 rounded bg-surface-container font-label-sm text-[11px]">
          <span className="text-on-surface-variant">Active Target:</span>
          <span className="font-medium text-primary truncate max-w-[200px]" title={activeDoc?.title}>
            {activeDoc ? activeDoc.title : 'Section 2.3 + 3 selected sources'}
          </span>
        </div>
      </div>

      {/* Assistant Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-space-sm py-space-sm space-y-3 select-text">
        {messages.map((m, idx) => (
          <div key={idx} className="space-y-1">
            {m.role === 'user' ? (
              <div className="flex flex-col items-end space-y-1">
                <div className="bg-primary-fixed text-on-primary-fixed p-2.5 rounded-lg max-w-[92%] shadow-xs">
                  <p className="font-body-ui text-[12px] leading-relaxed">
                    {m.content}
                  </p>
                </div>
                <span className="font-label-code text-[9px] text-outline px-1">You · {m.time || 'now'}</span>
              </div>
            ) : (
              <div className="flex flex-col space-y-1.5">
                <div className="flex items-center gap-1 px-1">
                  <span className="material-symbols-outlined text-primary text-[14px]">auto_awesome</span>
                  <span className="font-label-sm text-[11px] font-semibold text-on-surface">Synthesis Copilot</span>
                  <span className="font-label-code text-[9px] text-outline">· Gemini 1.5 Flash</span>
                </div>

                <div className="bg-surface-container-low p-3 rounded-lg shadow-xs space-y-2 text-on-surface border border-surface-container">
                  <p className="font-body-ui text-[12px] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>

                  {/* Evidence Card if present */}
                  {m.evidence && (
                    <div className="p-2 rounded bg-surface-container-lowest space-y-1.5 shadow-xs border border-surface-container-high">
                      <div className="flex items-center justify-between text-[10px] font-label-sm text-tertiary font-medium">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">policy</span>
                          <span>Discovered Corroboration</span>
                        </span>
                        <span className="font-label-code">arXiv:2409.11894</span>
                      </div>
                      <div className="p-1.5 bg-surface-container-low rounded text-[11px] font-body-paper italic text-on-surface-variant">
                        {m.evidence.snippet}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-label-code text-outline pt-0.5">
                        <span className="hover:text-primary underline flex items-center gap-0.5">
                          <span>doi:{m.evidence.doi}</span>
                          <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                        </span>
                        <span className="text-tertiary font-medium">{m.evidence.match}</span>
                      </div>
                    </div>
                  )}

                  {/* Suggested Next Action Chips */}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="font-label-sm text-[10px] uppercase font-semibold text-outline tracking-wider block">
                        Suggested Next Actions
                      </span>
                      <div className="flex flex-col gap-1">
                        {m.suggestions.map((sug, i) => (
                          <button 
                            key={i}
                            onClick={() => {
                              if (sug.includes('Settings')) setCurrentView('settings');
                              else handleSend(sug);
                            }}
                            className="w-full text-left px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-[11px] flex items-center justify-between transition-colors group"
                          >
                            <span className="truncate">{sug}</span>
                            <span className="material-symbols-outlined text-[12px] text-outline group-hover:text-primary">
                              arrow_forward
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="font-label-code text-[9px] text-outline px-1">AI Agent · {m.time || 'now'}</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg text-outline text-xs">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            <span>Synthesizing citation matrices...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Pinned Smart Composer */}
      <div className="p-space-sm bg-surface-container-lowest shrink-0 shadow-[0_-2px_8px_rgba(19,27,46,0.04)] flex flex-col gap-1.5 border-t border-surface-container">
        {/* Context Pills Active Toggle */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          <button 
            onClick={() => handleSend('Critique the currently selected paragraph in my manuscript.')}
            className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-sm text-[10px] flex items-center gap-0.5 whitespace-nowrap transition-colors"
          >
            <span className="material-symbols-outlined text-[11px]">attachment</span>
            <span>+ Attach Selection</span>
          </button>
          <button 
            onClick={() => setAttachPaper(!attachPaper)}
            className={`px-1.5 py-0.5 rounded font-label-sm text-[10px] flex items-center gap-0.5 whitespace-nowrap transition-colors ${
              attachPaper 
                ? 'bg-primary-fixed text-on-primary-fixed font-medium' 
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[11px]">library_books</span>
            <span>{attachPaper ? 'Paper Context: ON' : '+ Attach Paper'}</span>
          </button>
          <button className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-tertiary font-label-sm text-[10px] font-medium flex items-center gap-0.5 whitespace-nowrap">
            <span className="w-1 h-1 rounded-full bg-tertiary"></span>
            <span>Search: ON</span>
          </button>
        </div>

        {/* Textarea Field Container */}
        <div className="relative bg-surface-container-low rounded-lg p-2 focus-within:ring-1 focus-within:ring-primary focus-within:bg-surface-container-lowest transition-all border border-outline-variant">
          <textarea 
            className="w-full bg-transparent text-body-ui text-[12px] text-on-surface placeholder:text-outline resize-none focus:outline-none" 
            placeholder="Ask anything, compare claims, or summarize paper..." 
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between pt-1 mt-1 border-t border-surface-container">
            <div className="flex items-center gap-1 text-outline font-label-code text-[10px]">
              <span title="Enter to send">↵ Send</span>
              <span>·</span>
              <span title="Shift+Enter for newline">⇧↵ Newline</span>
            </div>
            <button 
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-7 h-7 rounded bg-primary text-on-primary hover:bg-primary-container flex items-center justify-center transition-colors shadow-xs disabled:opacity-40" 
              title="Submit prompt to assistant"
            >
              <span className="material-symbols-outlined text-[15px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
