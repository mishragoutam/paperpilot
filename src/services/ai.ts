import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Source } from './db';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentContext {
  title: string;
  content: string; // Plain text or HTML
}

export interface DiscoveredModel {
  id: string;
  name: string;
  displayName: string;
}

// In-memory cache for the validated working model
let cachedWorkingModel: string | null = null;

// Fallback priority list when a model returns 404
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

export const aiService = {
  /**
   * Fetch the list of available models directly from the Gemini API using the user's API key.
   */
  async getAvailableModels(apiKey: string): Promise<DiscoveredModel[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data.models)) {
        const supported = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: cleanId,
              name: m.name,
              displayName: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
            };
          });
        return supported;
      }
      return [];
    } catch (e) {
      console.warn('Could not query ListModels:', e);
      return [];
    }
  },

  /**
   * Discovers and verifies the active working model for this API key.
   * If the requested model 404s, seamlessly tests fallback candidates or queries ListModels.
   */
  async resolveWorkingModel(apiKey: string, preferredModel?: string): Promise<string> {
    const key = apiKey.trim();
    if (!key) throw new Error('Gemini API key is required');

    const genAI = new GoogleGenerativeAI(key);

    // Build unique candidate sequence
    const toTry = Array.from(new Set([
      preferredModel,
      cachedWorkingModel,
      ...CANDIDATE_MODELS
    ].filter(Boolean))) as string[];

    for (const cand of toTry) {
      try {
        const m = genAI.getGenerativeModel({ model: cand });
        const res = await m.generateContent('ping');
        await res.response;
        cachedWorkingModel = cand;
        return cand;
      } catch (err: any) {
        const msg = String(err?.message || err);
        // If it's a 404 / model not supported, try the next candidate
        if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
          continue;
        }
        // If it's an invalid API key, throw immediately
        if (msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
          throw err;
        }
      }
    }

    // Try live discovery via REST endpoint if candidates failed
    const available = await aiService.getAvailableModels(key);
    if (available.length > 0) {
      for (const item of available) {
        try {
          const m = genAI.getGenerativeModel({ model: item.id });
          const res = await m.generateContent('ping');
          await res.response;
          cachedWorkingModel = item.id;
          return item.id;
        } catch {
          continue;
        }
      }
    }

    // Default safe fallback
    return preferredModel || 'gemini-2.0-flash';
  },

  /**
   * Send a multi-turn chat message to Gemini with optional research paper context.
   */
  async sendChatMessage(
    apiKey: string,
    history: ChatMessage[],
    userMessage: string,
    docContext?: DocumentContext,
    preferredModel?: string
  ): Promise<string> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Gemini API key is missing. Please go to Settings and enter your Google Gemini API key.');
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());

    // Provide rich academic system instructions
    let systemInstruction = 
      'You are PaperPilot AI, an elite academic research assistant and co-author. ' +
      'Your goals are: (1) assist researchers and students in writing high-impact papers, ' +
      '(2) suggest precise academic phrasing, citations, and literature contexts, ' +
      '(3) evaluate originality and factual consistency, and ' +
      '(4) provide clear, well-structured academic responses with markdown formatting.';

    if (docContext && docContext.title) {
      const cleanContent = docContext.content
        ? docContext.content.replace(/<[^>]*>?/gm, '').slice(0, 4000)
        : '(Document is currently empty)';

      systemInstruction += `\n\n[ACTIVE DOCUMENT CONTEXT]\nTitle: "${docContext.title}"\nManuscript Excerpt:\n"""\n${cleanContent}\n"""\nUse this context when the user asks questions regarding their current draft.`;
    }

    // Sanitize conversation history for Gemini:
    // 1. Filter out error bubbles
    const rawHistory = history
      .filter(m => m.content && m.content.trim() && !m.content.startsWith('⚠️') && !m.content.startsWith('Error:'))
      .map((msg) => ({
        role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: msg.content }],
      }));

    // 2. Gemini strictly requires history to start with role 'user'
    const firstUserIdx = rawHistory.findIndex(m => m.role === 'user');
    let sanitizedHistory: typeof rawHistory = [];

    if (firstUserIdx !== -1) {
      const sliced = rawHistory.slice(firstUserIdx);
      for (const item of sliced) {
        if (sanitizedHistory.length === 0) {
          sanitizedHistory.push(item);
        } else {
          const lastRole = sanitizedHistory[sanitizedHistory.length - 1].role;
          if (item.role !== lastRole) {
            sanitizedHistory.push(item);
          }
        }
      }

      // If the last message in history is 'user', remove it so sendMessage can provide the next user turn
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }
    }

    // Resolve model name dynamically
    let modelName = preferredModel || cachedWorkingModel || 'gemini-2.0-flash';

    const executeChat = async (mName: string) => {
      const model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction,
      });

      const chat = model.startChat({
        history: sanitizedHistory,
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      cachedWorkingModel = mName;
      return response.text();
    };

    try {
      return await executeChat(modelName);
    } catch (err: any) {
      const msg = String(err?.message || err);
      // If 404 / model not found, resolve a working model and retry
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
        try {
          const resolved = await aiService.resolveWorkingModel(apiKey, preferredModel);
          if (resolved !== modelName) {
            return await executeChat(resolved);
          }
        } catch (resolveErr) {
          console.error('Failed to resolve fallback model:', resolveErr);
        }
      }
      console.error('Gemini Chat Error:', err);
      return aiService.handleApiError(err);
    }
  },

  /**
   * Search and synthesize relevant research papers on a given topic using Gemini.
   */
  async searchPapers(apiKey: string, topic: string, preferredModel?: string): Promise<Partial<Source>[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Gemini API key is missing. Please enter your API key in Settings.');
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    let modelName = preferredModel || cachedWorkingModel || 'gemini-2.0-flash';

    const executeSearch = async (mName: string) => {
      const model = genAI.getGenerativeModel({
        model: mName,
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction:
          'You are an academic bibliographic search assistant. Given a topic, output a JSON array of 3-5 real or highly plausible research papers, including title, authors, publication (journal or conference), publishedAt (year), doi or url, and a concise 2-sentence snippet highlighting their findings and methodology.',
      });

      const prompt = `Return a JSON array of academic papers for the topic: "${topic}". Each object must have fields: "title", "authors", "publication", "publishedAt", "doi", "snippet", "abstract".`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);
      cachedWorkingModel = mName;
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: `source-${Date.now()}-${index}`,
          title: item.title || 'Untitled Research Paper',
          authors: item.authors || 'Unknown Authors',
          publication: item.publication || 'Academic Repository',
          publishedAt: String(item.publishedAt || new Date().getFullYear()),
          url: item.doi ? `https://doi.org/${item.doi}` : item.url || '',
          doi: item.doi || '',
          snippet: item.snippet || item.abstract || '',
          abstract: item.abstract || item.snippet || '',
          accessedAt: new Date().toISOString(),
          notes: '',
        }));
      }
      return [];
    };

    try {
      return await executeSearch(modelName);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
        try {
          const resolved = await aiService.resolveWorkingModel(apiKey, preferredModel);
          if (resolved !== modelName) {
            return await executeSearch(resolved);
          }
        } catch {
          // continue to handle error
        }
      }
      console.error('Gemini Search Error:', err);
      throw new Error(aiService.handleApiError(err));
    }
  },

  /**
   * Friendly error translation for common Gemini API issues.
   */
  handleApiError(err: any): string {
    const message = err?.message || String(err);
    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      return '⚠️ Invalid Gemini API Key. Please verify your API key in Settings.';
    }
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      return '⚠️ Gemini API quota or rate limit exceeded. Please wait a moment or check your Google AI Studio plan.';
    }
    if (message.includes('SAFETY') || message.includes('blocked')) {
      return '⚠️ The request was blocked due to safety guidelines.';
    }
    if (message.includes('404') || message.includes('not found')) {
      return '⚠️ Model not found on your current Gemini API tier. Please go to Settings and click "Test Connection" to auto-detect your available models.';
    }
    if (message.includes('FetchError') || message.includes('Failed to fetch') || message.includes('ENOTFOUND')) {
      return '⚠️ Network error: Unable to reach Gemini API. Please check your internet connection.';
    }
    return `⚠️ Gemini API Error: ${message}`;
  },
};
