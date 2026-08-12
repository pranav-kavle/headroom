"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import type { ConnectorCursorRow } from "@headroom/graph";
import { initialsFromEmail } from "@/lib/initials";
import { TopBar } from "@/components/nav/TopBar";
import styles from "./AccountView.module.css";

type SourceKey = "gmail" | "calendar" | "github" | "google_health";

const SOURCES: Array<{ key: SourceKey; label: string; code: string; color: string }> = [
  { key: "gmail", label: "Gmail", code: "M", color: "#EA4335" },
  { key: "calendar", label: "Google Calendar", code: "C", color: "#4285F4" },
  { key: "github", label: "GitHub", code: "GH", color: "#181717" },
  { key: "google_health", label: "Google Health", code: "H", color: "#00B0B9" },
];

type Tier1Action = {
  key: string;
  label: string;
  description: string;
  defaultOn: boolean;
};

const TIER_1_ACTIONS: Tier1Action[] = [
  { key: "draft_replies", label: "Draft replies", description: "Saved to Drafts, never sent", defaultOn: true },
  { key: "hold_time", label: "Hold time on your calendar", description: "Only in free slots", defaultOn: true },
  {
    key: "triage_email",
    label: "Triage and label email",
    description: "Archive newsletters, label the rest",
    defaultOn: true,
  },
  { key: "tidy_issues", label: "Tidy GitHub issues", description: "Label, assign, close stale", defaultOn: true },
  {
    key: "approve_dependency_prs",
    label: "Approve dependency PRs",
    description: "Lockfile-only changes",
    defaultOn: false,
  },
];

const TIER_2_ACTIONS = ["Send a drafted reply", "Decline or move a meeting", "Comment on a PR"];

function describeSource(cursor: ConnectorCursorRow | undefined): { detail: string; warn: boolean } {
  if (!cursor) return { detail: "Not connected", warn: false };
  if (cursor.status === "error") {
    return { detail: cursor.errorMessage ?? "Reconnect needed", warn: true };
  }
  if (cursor.lastSyncedAt) {
    return { detail: `Synced ${cursor.lastSyncedAt.toLocaleString()}`, warn: false };
  }
  return { detail: "Connected, not yet synced", warn: false };
}

export function AccountView({ email, sources }: { email: string; sources: ConnectorCursorRow[] }) {
  const { signOut } = useClerk();
  const [tier1State, setTier1State] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TIER_1_ACTIONS.map((action) => [action.key, action.defaultOn])),
  );
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);
  const [readAloudEnabled, setReadAloudEnabled] = useState(false);

  const sourceByKey = new Map(sources.map((cursor) => [cursor.source as SourceKey, cursor]));

  return (
    <>
      <TopBar variant="back" label="Back" href="/brief" />
      <main className={styles.screen}>
        <div className={styles.acctHead}>
          <div className={styles.avLg}>{initialsFromEmail(email)}</div>
          <div className={styles.n}>
            <b>{email}</b>
          </div>
        </div>

        <div className={styles.gtitle}>Sources</div>
        <div className={styles.card}>
          {SOURCES.map((source) => {
            const { detail, warn } = describeSource(sourceByKey.get(source.key));
            return (
              <div className={styles.arow} key={source.key}>
                <div className={styles.srowIcon} style={{ background: source.color }}>
                  {source.code}
                </div>
                <div className={styles.t}>
                  <b>{source.label}</b>
                  <em>{detail}</em>
                </div>
                {warn && <div className={styles.warnpill}>Reconnect</div>}
              </div>
            );
          })}
        </div>

        <div className={styles.gtitle}>What Headroom may do on its own</div>

        <div className={styles.tier}>
          <b>Private &amp; reversible</b>
          <em>· runs unattended</em>
        </div>
        <div className={styles.card}>
          {TIER_1_ACTIONS.map((action) => (
            <div className={styles.arow} key={action.key}>
              <div className={styles.t}>
                <b>{action.label}</b>
                <em>{action.description}</em>
              </div>
              <button
                type="button"
                className={styles.tog}
                data-on={tier1State[action.key]}
                aria-pressed={tier1State[action.key]}
                aria-label={action.label}
                onClick={() =>
                  setTier1State((state) => ({ ...state, [action.key]: !state[action.key] }))
                }
              />
            </div>
          ))}
        </div>

        <div className={styles.tier} style={{ marginTop: 22 }}>
          <b>Outward-facing</b>
          <em>· always asks first</em>
        </div>
        <div className={styles.card}>
          {TIER_2_ACTIONS.map((label) => (
            <div className={styles.arow} key={label}>
              <div className={styles.t}>
                <b>{label}</b>
              </div>
              <div className={styles.lockpill}>One tap</div>
            </div>
          ))}
        </div>

        <div className={styles.tier} style={{ marginTop: 22 }}>
          <b>Money &amp; third parties</b>
          <em>· never</em>
        </div>
        <div className={`${styles.card} ${styles.locked}`}>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Purchases, bookings, cancellations</b>
              <em>Headroom will prepare these. It will not execute them.</em>
            </div>
            <div className={styles.lockpill}>Off by design</div>
          </div>
        </div>

        <div className={styles.guard}>
          <b>The hard line.</b> Nothing leaves this device outward-facing without your approval, and
          every unattended action is logged in the Ledger with an Undo.
        </div>

        <div className={styles.gtitle}>Brief</div>
        <div className={styles.card}>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Morning brief</b>
            </div>
            <div className={styles.v}>7:00 AM</div>
          </div>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Push notifications</b>
              <em>Event-driven and scheduled</em>
            </div>
            <button
              type="button"
              className={styles.tog}
              data-on={pushEnabled}
              aria-pressed={pushEnabled}
              aria-label="Push notifications"
              onClick={() => setPushEnabled((value) => !value)}
            />
          </div>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Email digest</b>
              <em>Backup channel, same content</em>
            </div>
            <button
              type="button"
              className={styles.tog}
              data-on={emailDigestEnabled}
              aria-pressed={emailDigestEnabled}
              aria-label="Email digest"
              onClick={() => setEmailDigestEnabled((value) => !value)}
            />
          </div>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Standing rules</b>
              <em>No meetings after 6pm · protect Fri PM</em>
            </div>
            <div className={styles.v}>2</div>
          </div>
        </div>

        <div className={styles.gtitle}>Voice</div>
        <div className={styles.card}>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Speaking voice</b>
            </div>
            <div className={styles.v}>Sonic · Calm</div>
          </div>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Read the brief aloud on open</b>
            </div>
            <button
              type="button"
              className={styles.tog}
              data-on={readAloudEnabled}
              aria-pressed={readAloudEnabled}
              aria-label="Read the brief aloud on open"
              onClick={() => setReadAloudEnabled((value) => !value)}
            />
          </div>
        </div>

        <div className={styles.gtitle}>Data</div>
        <div className={styles.card}>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b>Export everything</b>
              <em>Graph, sources, and ledger as JSON</em>
            </div>
          </div>
          <div className={styles.arow}>
            <div className={styles.t}>
              <b className={styles.danger}>Delete my graph</b>
              <em>Sources stay connected. Extraction starts over.</em>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ marginTop: 22 }}>
          <button type="button" className={styles.signOut} onClick={() => signOut({ redirectUrl: "/sign-in" })}>
            Sign out
          </button>
        </div>
      </main>
    </>
  );
}
