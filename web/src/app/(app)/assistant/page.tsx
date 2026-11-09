"use client";
/**
 * Assistant — chat with the multi-provider LLM backend.
 *
 * PL-17: the answer engine is a free chain Groq → OpenRouter → NVIDIA,
 * degrading to a deterministic `rules_stub`. The screen states WHICH engine
 * answered under every reply — a chat bubble with no attribution would
 * let a canned string pass for a model's answer.
 *
 * Voice output: "Listen" calls the real Gnani Timbre TTS endpoint and plays
 * the returned WAV. When Gnani is unreachable the error says so — the text
 * answer above is always the full response (no fake audio).
 */
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAssistant } from "@/stores/assistant";
import { useAuthSession } from "@/hooks/useAuth";
import { API_URL } from "@/lib/constants";

/** Starter questions that exercise the real backend paths. */
const SUGGESTIONS = [
  "Which areas of Delhi NCR currently have the most open incidents?",
  "How would you dispatch a fire team for an incident in Gurugram?",
  "What should a citizen do during a waterlogging event?",
  "Explain the ASTRA incident lifecycle from report to closure.",
];

function providerLabel(provider: string | null | undefined): {
  text: string;
  tone: string;
} {
  if (!provider) return { text: "unknown engine", tone: "text-[var(--muted)]" };
  if (provider === "rules_stub") {
    return {
      text: "rules stub — deterministic, not a language model",
      tone: "text-[var(--warning)]",
    };
  }
  const model = provider.replace(/^llm:/, "");
  return { text: model, tone: "text-[var(--subtle)]" };
}

export default function AssistantPage() {
  const { token } = useAuthSession();
  const { messages, loading, error, send, clear, lastProvider } = useAssistant();
  const [input, setInput] = useState("");

  // --- Gnani Timbre TTS — one audio at a time, honest error state ---
  type TtsState = { msgId: string; status: "loading" | "playing" | "error"; err?: string };
  const [tts, setTts] = useState<TtsState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const listen = async (msgId: string, text: string) => {
    if (tts?.msgId === msgId && tts.status === "playing") {
      stopAudio();
      setTts(null);
      return;
    }
    stopAudio();
    setTts({ msgId, status: "loading" });
    try {
      const res = await fetch(`${API_URL}/api/v1/voice/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, language_code: "en-IN" }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Gnani TTS unavailable (HTTP ${res.status}). ${detail.slice(0, 120)}`);
      }
      const blob = await res.blob();
      if (!blob.size || blob.size < 1000) {
        throw new Error("Gnani TTS returned no audible audio.");
      }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        stopAudio();
        setTts(null);
      };
      audio.onerror = () => {
        stopAudio();
        setTts({ msgId, status: "error", err: "Audio playback failed." });
      };
      setTts({ msgId, status: "playing" });
      await audio.play();
    } catch (e) {
      stopAudio();
      setTts({
        msgId,
        status: "error",
        err: e instanceof Error ? e.message : "Gnani TTS unavailable.",
      });
    }
  };

  const handleSend = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");
    await send(message, token);
  };

  const engine = providerLabel(lastProvider);

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Free LLM chain: Groq → OpenRouter → NVIDIA → deterministic rules"
      />
      <Card>
        <div className="flex flex-col gap-3 min-h-[24rem]">
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[32rem]">
            {messages.length === 0 && (
              <div className="space-y-4">
                <EmptyState
                  title="No messages"
                  body="Ask about incidents, dispatch, routing or what a citizen should do."
                  icon="🤖"
                />
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Try one of these
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void handleSend(s)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((m) => {
              const label = providerLabel(m.provider);
              const ttsState =
                tts?.msgId === m.id ? tts : null;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg p-2 text-xs ${
                    m.role === "user"
                      ? "bg-[var(--surface-2)] text-right"
                      : "bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[var(--muted)]">
                      {m.role === "user" ? "You" : "Assistant"}
                    </span>
                    {m.role === "assistant" && (
                      <span className={`text-[9px] ${label.tone}`}>
                        {label.text}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
                  {m.role === "assistant" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void listen(m.id, m.text)}
                        disabled={ttsState?.status === "loading"}
                        className="min-h-8 rounded border border-[var(--border-strong)] bg-[var(--background)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
                        title="Read this answer aloud with Gnani Timbre TTS"
                      >
                        {ttsState?.status === "loading"
                          ? "Generating audio…"
                          : ttsState?.status === "playing"
                            ? "■ Stop"
                            : "🔊 Listen (Gnani Timbre)"}
                      </button>
                      {ttsState?.status === "error" && (
                        <span className="text-[9px] text-[var(--danger)]">
                          {ttsState.err} — the text answer above is the full
                          response.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <p className="text-[10px] text-[var(--muted)]">
                Thinking — trying the provider chain…
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-3 py-2 text-[11px] text-[#fee2e2]"
              >
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex gap-2">
              <input
                className="min-h-10 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                placeholder="Ask something…"
                aria-label="Message the assistant"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSend();
                }}
                disabled={loading}
              />
              <Button
                variant="primary"
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
              >
                Send
              </Button>
              <Button onClick={clear} variant="secondary" disabled={loading}>
                Clear
              </Button>
            </div>
            {lastProvider && (
              <p className="mt-2 text-[10px] text-[var(--subtle)]">
                Last answer came from{" "}
                <span className={engine.tone}>{engine.text}</span>. When every
                provider is unreachable the assistant answers from the
                deterministic rules stub and says so.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
