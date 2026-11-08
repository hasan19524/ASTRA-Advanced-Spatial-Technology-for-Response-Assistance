"use client";
/**
 * Assistant — chat with the multi-provider LLM backend.
 */
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAssistant } from "@/stores/assistant";
import { useAuthSession } from "@/hooks/useAuth";

export default function AssistantPage() {
  const { token } = useAuthSession();
  const { messages, loading, error, send, clear } = useAssistant();
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text, token);
  };

  return (
    <div>
      <PageHeader title="AI Assistant" subtitle="Multi-provider free LLM (Groq / OpenRouter / NVIDIA)" />
      <Card>
        <div className="flex flex-col gap-3 min-h-[24rem]">
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[32rem]">
            {messages.length === 0 && (
              <EmptyState title="No messages" body="Ask the assistant anything." icon="🤖" />
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-2 text-xs ${m.role === "user" ? "bg-[var(--surface-2)] text-right" : "bg-[var(--surface)]"}`}
              >
                <span className="font-medium text-[var(--muted)]">{m.role === "user" ? "You" : "Assistant"}</span>
                <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {loading && <p className="text-[10px] text-[var(--muted)]">Thinking…</p>}
            {error && <p className="text-[10px] text-[var(--danger)]">{error}</p>}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
              placeholder="Ask something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>Send</Button>
            <Button onClick={clear} variant="secondary">Clear</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}