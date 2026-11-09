"use client";
/**
 * Voice language store — AD-16.
 *
 * The language list comes from the backend (`GET /api/v1/voice/languages`),
 * which mirrors the codes the Gnani voice proxy accepts. The selection is
 * persisted so the report form's microphone uses the language the user
 * actually chose in Settings.
 *
 * Before this existed, the Settings screen showed a hard-coded list of 12
 * languages with most buttons disabled and the note "selector wires up on
 * Day 7" — a control that looked like it worked but did not.
 */
import { create } from "zustand";
import { request } from "@/api/client";

const STORAGE_KEY = "astra.voice_language";
const FALLBACK = [{ code: "hi-IN", name: "Hindi" }, { code: "en-IN", name: "English (India)" }];

export interface VoiceLanguage {
  code: string;
  name: string;
}

interface VoiceLanguageState {
  languages: VoiceLanguage[];
  selected: string;
  loading: boolean;
  error: string | null;
  load: (token?: string | null) => Promise<void>;
  select: (code: string) => void;
}

function stored(): string {
  if (typeof window === "undefined") return "hi-IN";
  return window.localStorage.getItem(STORAGE_KEY) ?? "hi-IN";
}

export const useVoiceLanguage = create<VoiceLanguageState>((set) => ({
  languages: FALLBACK,
  selected: stored(),
  loading: false,
  error: null,

  async load(token) {
    set({ loading: true, error: null });
    try {
      const res = await request<VoiceLanguage[]>("/api/v1/voice/languages", { token });
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        set({ languages: list, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      // The voice proxy is optional (it needs a Gnani key). If it is not
      // configured the screen keeps the two defaults and says so.
      set({
        languages: FALLBACK,
        loading: false,
        error:
          e instanceof Error
            ? e.message
            : "Language list unavailable — showing the two built-in codes",
      });
    }
  },

  select(code) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, code);
    }
    set({ selected: code });
  },
}));
