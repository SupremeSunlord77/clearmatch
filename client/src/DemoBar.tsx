import { useState, type ReactNode } from "react";
import { api } from "./api";
import { copy } from "./copy";

/** Clearly labelled demo-only controls (D8). */
export function DemoBar({ children, onReset }: { children?: ReactNode; onReset: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    try {
      const { cleared } = await api.reset();
      setMessage(copy.demo.resetDone(cleared));
      onReset();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-bar" role="region" aria-label={copy.demo.label}>
      <span className="demo-tag">{copy.demo.label}</span>
      {children}
      <button type="button" onClick={reset} disabled={busy}>
        {busy ? copy.demo.resetting : copy.demo.reset}
      </button>
      {message && <span className="demo-message">{message}</span>}
    </div>
  );
}
