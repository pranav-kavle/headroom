"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";

export function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setLinkToken(data.linkToken));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>((publicToken) => {
    setStatus("Connecting…");
    fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        setStatus(`Connected — ${data.accounts?.length ?? 0} account(s) added`);
      })
      .catch(() => setStatus("Failed to connect — check server logs"));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <button className="btn primary sm" disabled={!ready} onClick={() => open()}>
        Connect bank
      </button>
      {status && (
        <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{status}</p>
      )}
    </div>
  );
}
