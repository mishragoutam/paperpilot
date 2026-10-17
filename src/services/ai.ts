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

// In-memory + persistent cache for the validated fastest working model
let cachedWorkingModel: string | null = (() => {
  try {
    return localStorage.getItem('paperpilot_working_model') || 'gemini-2.0-flash';
  } catch {
    return 'gemini-2.0-flash';
  }
})();

export function setCachedWorkingModel(model: string) {
  cachedWorkingModel = model;
  try {
    localStorage.setItem('paperpilot_working_model', model);
  } catch {}
}

// Fallback priority list optimized for speed and low-latency response
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
];

/**
 * Checks if an error is due to model tier limits, 404, or temporary 503 server load.
 */
export function isRetryableModelError(err: any): boolean {
  const msg = String(err?.message || err);
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not supported') ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504')
  );
}

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

        // Prioritize rock-solid GA models to avoid preview/high-demand errors
        supported.sort((a: any, b: any) => {
          const rank = (id: string) => {
            if (id === 'gemini-2.0-flash') return 1;
            if (id === 'gemini-1.5-flash') return 2;
            if (id === 'gemini-2.5-flash') return 3;
            if (id === 'gemini-1.5-pro') return 4;
            if (id.includes('flash') && !id.includes('preview')) return 5;
            if (id.includes('pro') && !id.includes('preview')) return 6;
            return 10;
          };
          return rank(a.id) - rank(b.id);
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
   * If the requested model 404s or has 503 high demand, seamlessly tests fallback candidates or queries ListModels.
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
        // If it's a 404 or 503 high demand, try the next candidate
        if (isRetryableModelError(err)) {
          console.warn(`Model candidate ${cand} returned retryable status (${msg}). Testing next candidate...`);
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
    return 'gemini-2.0-flash';
  },

  /**
   * Send a multi-turn chat message to Gemini with optional research paper context.
   */
  async sendChatMessage(
    apiKey: string,
    history: ChatMessage[],
    userMessage: string,
    docContext?: DocumentContext,
    preferredModel?: string,
    speedMode: 'turbo' | 'balanced' | 'deep' = 'turbo'
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
        ? docContext.content.replace(/<[^>]*>?/gm, '').trim().slice(0, 1500)
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

    // 2. Window conversation history to recent turns for blazing-fast prompt processing
    const historyWindow = rawHistory.slice(-8);

    // 3. Gemini strictly requires history to start with role 'user'
    const firstUserIdx = historyWindow.findIndex(m => m.role === 'user');
    let sanitizedHistory: typeof historyWindow = [];

    if (firstUserIdx !== -1) {
      const sliced = historyWindow.slice(firstUserIdx);
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

    // Resolve model sequence with auto-failover
    const modelsToTry = Array.from(new Set([
      preferredModel,
      cachedWorkingModel,
      ...CANDIDATE_MODELS
    ].filter(Boolean))) as string[];

    const executeChat = async (mName: string) => {
      const model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction,
        generationConfig: {
          temperature: 0.65,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      const chat = model.startChat({
        history: sanitizedHistory,
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      setCachedWorkingModel(mName);
      return response.text();
    };

    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      try {
        return await executeChat(currentModel);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        if (msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
          throw err;
        }
        if (isRetryableModelError(err)) {
          const nextModel = modelsToTry[i + 1] || 'default';
          console.warn(`[PaperPilot AI] Model ${currentModel} encountered retryable issue (${msg.slice(0, 100)}...). Auto-failing over to ${nextModel}...`);
          continue;
        }
        return aiService.handleApiError(err);
      }
    }

    return aiService.handleApiError(lastError);
  },

  /**
   * Stream a multi-turn chat response from Gemini in real time.
   */
  async streamChatMessage(
    apiKey: string,
    history: ChatMessage[],
    userMessage: string,
    onChunk: (accumulatedText: string) => void,
    docContext?: DocumentContext,
    preferredModel?: string,
    speedMode: 'turbo' | 'balanced' | 'deep' = 'turbo'
  ): Promise<string> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Gemini API key is missing. Please go to Settings and enter your Google Gemini API key.');
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());

    let systemInstruction = 
      'You are PaperPilot AI, an elite academic research assistant and co-author. ' +
      'Your goals are: (1) assist researchers and students in writing high-impact papers, ' +
      '(2) suggest precise academic phrasing, citations, and literature contexts, ' +
      '(3) evaluate originality and factual consistency, and ' +
      '(4) provide clear, well-structured academic responses with markdown formatting.';

    if (docContext && docContext.title) {
      const cleanContent = docContext.content
        ? docContext.content.replace(/<[^>]*>?/gm, '').trim().slice(0, 1500)
        : '(Document is currently empty)';

      systemInstruction += `\n\n[ACTIVE DOCUMENT CONTEXT]\nTitle: "${docContext.title}"\nManuscript Excerpt:\n"""\n${cleanContent}\n"""\nUse this context when the user asks questions regarding their current draft.`;
    }

    const rawHistory = history
      .filter(m => m.content && m.content.trim() && !m.content.startsWith('⚠️') && !m.content.startsWith('Error:'))
      .map((msg) => ({
        role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: msg.content }],
      }));

    // Window conversation history to recent turns for blazing-fast prompt ingestion
    const historyWindow = rawHistory.slice(-8);

    const firstUserIdx = historyWindow.findIndex(m => m.role === 'user');
    let sanitizedHistory: typeof historyWindow = [];

    if (firstUserIdx !== -1) {
      const sliced = historyWindow.slice(firstUserIdx);
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

      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }
    }

    // Build priority candidate sequence with auto-failover
    const modelsToTry = Array.from(new Set([
      preferredModel,
      cachedWorkingModel,
      ...CANDIDATE_MODELS
    ].filter(Boolean))) as string[];

    const executeStreamWithFallback = async (mName: string) => {
      const model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction,
        generationConfig: {
          temperature: 0.65,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      // 1. Try real-time streaming first
      let accumulated = '';
      try {
        const chat = model.startChat({ history: sanitizedHistory });
        const resultStream = await chat.sendMessageStream(userMessage);

        for await (const chunk of resultStream.stream) {
          const text = chunk.text();
          if (text) {
            accumulated += text;
            onChunk(accumulated);
          }
        }

        if (accumulated.trim()) {
          setCachedWorkingModel(mName);
          return accumulated;
        }
      } catch (streamErr: any) {
        // If the model is 503 (high demand) or 404, don't attempt sendMessage on the same overloaded model
        if (isRetryableModelError(streamErr)) {
          throw streamErr;
        }
        console.warn('Stream parser issue encountered, falling back to standard generation:', streamErr);
      }

      // 2. Seamless Fallback: execute standard non-streaming sendMessage without artificial delay
      const chatFallback = model.startChat({ history: sanitizedHistory });
      const result = await chatFallback.sendMessage(userMessage);
      const response = await result.response;
      const fullText = response.text();
      setCachedWorkingModel(mName);

      if (onChunk && fullText) {
        onChunk(fullText);
      }

      return fullText;
    };

    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      try {
        const response = await executeStreamWithFallback(currentModel);
        cachedWorkingModel = currentModel;
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        // Invalid API key aborts immediately
        if (msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
          throw err;
        }
        // Retryable: 503 high demand, 404, 500, UNAVAILABLE -> seamlessly try next candidate model
        if (isRetryableModelError(err)) {
          const nextModel = modelsToTry[i + 1] || 'none';
          console.warn(`[PaperPilot AI] Model ${currentModel} returned retryable error (${msg.slice(0, 100)}...). Auto-failing over to ${nextModel}...`);
          continue;
        }
        // Non-retryable error
        console.error('Gemini Stream Chat Error:', err);
        throw err;
      }
    }

    throw lastError || new Error('All Gemini model candidates failed.');
  },

  /**
   * Search real academic literature using CrossRef open REST API (150M+ indexed papers).
   * Works without an API key, and can be optionally enriched with Gemini.
   */
  async searchScholarlyLiterature(query: string, apiKey?: string, preferredModel?: string): Promise<Partial<Source>[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    try {
      const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=5&select=DOI,title,author,published,publisher,container-title,abstract`;
      const res = await fetch(crossrefUrl);
      if (res.ok) {
        const data = await res.json();
        const items = data?.message?.items;
        if (Array.isArray(items) && items.length > 0) {
          const sources: Partial<Source>[] = items.map((item: any, idx: number) => {
            const title = Array.isArray(item.title) ? item.title[0] : (item.title || 'Untitled Academic Paper');
            let authors = 'Scholarly Authors';
            if (Array.isArray(item.author) && item.author.length > 0) {
              const names = item.author.slice(0, 3).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim());
              authors = names.join(', ') + (item.author.length > 3 ? ' et al.' : '');
            }
            const year = item.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
            const journal = Array.isArray(item['container-title']) && item['container-title'][0] 
              ? item['container-title'][0] 
              : (item.publisher || 'Academic Repository');
            const doi = item.DOI || '';
            const abstractClean = item.abstract ? item.abstract.replace(/<[^>]+>/g, '').trim() : '';
            const snippet = abstractClean || `Empirical paper examining ${cleanQuery}. Published in ${journal} (${year}).`;

            return {
              id: `src-crossref-${Date.now()}-${idx}`,
              title,
              authors,
              publication: journal,
              publishedAt: String(year),
              url: doi ? `https://doi.org/${doi}` : '',
              doi,
              snippet,
              abstract: abstractClean || snippet,
              accessedAt: new Date().toISOString(),
              notes: '',
              tag: 'Peer-Reviewed'
            };
          });

          return sources;
        }
      }
    } catch (crossrefErr) {
      console.warn('CrossRef search request failed, falling back to Gemini synthesis:', crossrefErr);
    }

    // Fallback: If CrossRef is unavailable, use Gemini if key exists
    if (apiKey && apiKey.trim()) {
      return aiService.searchPapers(apiKey, cleanQuery, preferredModel);
    }

    return [];
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
    if (message.includes('Failed to parse stream')) {
      return '⚠️ Stream connection was interrupted by network. Automatic retry has been configured.';
    }
    return `⚠️ Gemini API Error: ${message}`;
  },

  /**
   * Benchmark and test roundtrip speed to Gemini in milliseconds.
   */
  async testLatency(apiKey: string, preferredModel?: string): Promise<{ latencyMs: number; model: string }> {
    const key = apiKey.trim();
    if (!key) throw new Error('Gemini API key is required');

    const modelName = preferredModel || cachedWorkingModel || 'gemini-2.0-flash';
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
    });

    const start = performance.now();
    const res = await model.generateContent('ping');
    await res.response;
    const latencyMs = Math.round(performance.now() - start);

    setCachedWorkingModel(modelName);
    return { latencyMs, model: modelName };
  },
};
