"use client";
/**
 * Assistant store — backed by the real API (Phase 4).
 * Endpoints: POST /assistant/conversations, GET /assistant/conversations,
 * GET /assistant/conversations/{id}/messages, POST /assistant/conversations/{id}/chat
 */
import { create } from "zustand";
import { request } from "@/api/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  /** Which engine produced this reply — "llm:<model>" or "rules_stub".
   *  Null for the user's own messages. */
  provider?: string | null;
}

interface AssistantState {
  conversationId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  language: string;
  /** The provider that answered the most recent turn. */
  lastProvider: string | null;

  startConversation: (token?: string | null, language?: string) => Promise<string | null>;
  send: (text: string, token?: string | null) => Promise<void>;
  clear: () => void;
}

export const useAssistant = create<AssistantState>((set, get) => ({
  conversationId: null,
  messages: [],
  loading: false,
  error: null,
  language: "en-IN",
  lastProvider: null,

  async startConversation(token, language = "en-IN") {
    set({ loading: true, error: null, language });
    try {
      const res = await request<{ id: string; language: string }>(
        "/api/v1/assistant/conversations",
        { method: "POST", body: { title: null, language }, token },
      );
      set({ conversationId: res.id, messages: [], loading: false, lastProvider: null });
      return res.id;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return null;
    }
  },

  async send(text, token) {
    const convId = get().conversationId;
    if (!convId) {
      const id = await get().startConversation(token, get().language);
      if (!id) return;
    }
    const cid = get().conversationId!;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: "user", text, at: new Date().toISOString() };
    set((s) => ({ messages: [...s.messages, userMsg], loading: true, error: null }));
    try {
      const res = await request<{ reply: string; provider?: string }>(
        `/api/v1/assistant/conversations/${cid}/chat`,
        { method: "POST", body: { text, language: get().language }, token },
      );
      const provider = res.provider ?? null;
      const reply: ChatMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        text: res.reply,
        at: new Date().toISOString(),
        provider,
      };
      set((s) => ({
        messages: [...s.messages, reply],
        loading: false,
        lastProvider: provider,
      }));
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clear() {
    set({ messages: [], conversationId: null, error: null, lastProvider: null });
  },
}));