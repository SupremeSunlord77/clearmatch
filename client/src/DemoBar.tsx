import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { copy } from "./copy";

/** Clearly labelled demo-only controls (D8, M7). onChanged reloads the page's data after a demo action. */
export function DemoBar({ children, onChanged }: { children?: ReactNode; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorActive, setErrorActive] = useState(false);

  const refreshStatus = useCallback(() => {
    api
      .demoStatus()
      .then((s) => setErrorActive(s.simulatedAiErrorActive))
      .catch(() => setErrorActive(false));
  }, []);

  useEffect(refreshStatus, [refreshStatus]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      setMessage(await action());
      refreshStatus();
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reset = () => run(async () => copy.demo.resetDone((await api.reset()).cleared));
  const simulate = () =>
    run(async () => ((await api.simulateAiError()).added === 0 ? copy.demo.simulateErrorAlready : ""));

  return (
    <div className="demo-bar" role="region" aria-label={copy.demo.label}>
      <span className="demo-tag">{copy.demo.label}</span>
      {children}
      <button type="button" onClick={simulate} disabled={busy}>
        {busy ? copy.demo.simulating : copy.demo.simulateError}
      </button>
      <button type="button" onClick={reset} disabled={busy}>
        {busy ? copy.demo.resetting : copy.demo.reset}
      </button>
      {errorActive && (
        <strong className="demo-active" role="status">
          {copy.demo.simulateErrorActive}
        </strong>
      )}
      {message && <span className="demo-message">{message}</span>}
    </div>
  );
}
