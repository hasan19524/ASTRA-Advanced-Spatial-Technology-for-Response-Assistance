"use client";
/** Assistant store — chat transcript + connection state (WS lands Day 8). */
import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
}

interface AssistantState {
  messages: ChatMessage[];
  connected: boolean;
  listening: boolean;
  error: string | null;

  send: (text: string) => void;
  push: (msg: ChatMessage) => void;
  setConnected: (v: boolean) => void;
  setListening: (v: boolean) => void;
  clear: () => void;
}

let seq = 0;
const now = () => new Date().toISOString();

export const useAssistant = create<AssistantState>((set) => ({
  messages: [],
  connected: false,
  listening: false,
  error: null,

  send(text) {
    const userMsg: ChatMessage = { id: `m${++seq}`, role: "user", text, at: now() };
    set((s) => ({ messages: [...s.messages, userMsg] }));
    // placeholder reply until WS /ws/assistant exists (Day 8)
    const reply: ChatMessage = {
      id: `m${++seq}`,
      role: "assistant",
      text: "Assistant backend is not connected yet — this is a local preview reply.",
      at: now(),
    };
    setTimeout(() => {
      set((s) => ({ messages: [...s.messages, reply] }));
    }, 300);
  },

  push: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setConnected: (connected) => set({ connected }),
  setListening: (listening) => set({ listening }),
  clear: () => set({ messages: [] }),
}));
