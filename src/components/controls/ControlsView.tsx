"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useReverification, useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError, isReverificationCancelledError } from "@clerk/nextjs/errors";
import type { ConnectorCursorRow } from "@headroom/graph";
import { initialsFromEmail } from "@/lib/initials";
import styles from "./ControlsView.module.css";

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

type SourceState = { detail: string; warn: boolean; soon: boolean };

// No cursor means the connector has never run — which today means it does not
// exist yet. Saying "Not connected" next to no way to connect it reads as a
// broken button; "Soon" is the truth.
function describeSource(cursor: ConnectorCursorRow | undefined): SourceState {
  if (!cursor) return { detail: "Not connected yet", warn: false, soon: true };
  if (cursor.status === "error") {
    return { detail: cursor.errorMessage ?? "Reconnect needed", warn: true, soon: false };
  }
  if (cursor.lastSyncedAt) {
    return { detail: `Synced ${cursor.lastSyncedAt.toLocaleString()}`, warn: false, soon: false };
  }
  return { detail: "Connected, not yet synced", warn: false, soon: false };
}

export function ControlsView({
  email,
  name,
  sources,
  googleHealthConnected,
}: {
  email: string;
  name: string;
  sources: ConnectorCursorRow[];
  // Health's OAuth token lives in our own GoogleHealthToken table, not on
  // Clerk's Google connection (2026-08-14 spec §9a) — so unlike Calendar,
  // this can't be read off `user.externalAccounts` client-side. It has to
  // come down as a prop from the server, same as `sources`.
  googleHealthConnected: boolean;
}) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const githubConnected = user?.externalAccounts?.some((account) => account.provider === "github") ?? false;
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [githubSyncError, setGithubSyncError] = useState<string | null>(null);

  // Calendar still shares Clerk's Google social connection — Clerk stacks
  // additionalScopes onto the same external account. Checking the provider
  // alone isn't enough: sign-in already connects Google with only
  // email/profile scopes, so this checks for calendar's own scope being
  // present in approvedScopes, not just that a Google account exists —
  // otherwise it reads as "connected" when the token can't actually reach
  // Calendar at all. Health can't use this connection at all (spec §9a —
  // its API rejects tokens carrying any other scope, including Clerk's
  // baseline ones) so its connected state comes down as a prop instead.
  const googleAccount = user?.externalAccounts?.find((account) => account.provider === "google");
  const hasGoogleScope = (scope: string) => googleAccount?.approvedScopes?.split(" ").includes(scope) ?? false;
  const googleCalendarConnected = hasGoogleScope("https://www.googleapis.com/auth/calendar.readonly");
  const [googleCalendarConnectError, setGoogleCalendarConnectError] = useState<string | null>(null);
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false);
  const [googleCalendarSyncError, setGoogleCalendarSyncError] = useState<string | null>(null);
  const [googleHealthSyncing, setGoogleHealthSyncing] = useState(false);
  const [googleHealthSyncError, setGoogleHealthSyncError] = useState<string | null>(null);

  // Linking an external account is a sensitive operation — Clerk requires the
  // session to be freshly re-verified first and throws
  // session_reverification_required otherwise. useReverification shows Clerk's
  // built-in step-up modal and retries createExternalAccount once it passes.
  const createGithubExternalAccount = useReverification(() => {
    if (!user) return undefined;
    return user.createExternalAccount({
      strategy: "oauth_github",
      additionalScopes: ["repo"],
      redirectUrl: "/controls",
    });
  });

  const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

  // createExternalAccount only creates a brand-new provider connection —
  // Clerk allows one account per provider, so calling it when Google is
  // already connected (as it is for anyone who signed up with Google)
  // fails with oauth_account_already_connected. Adding scopes to an
  // existing connection is reauthorize() on the account itself instead.
  const connectGoogleCalendarAccount = useReverification(() => {
    if (!user) return undefined;
    if (googleAccount) {
      return googleAccount.reauthorize({ additionalScopes: GOOGLE_CALENDAR_SCOPES, redirectUrl: "/controls" });
    }
    return user.createExternalAccount({
      strategy: "oauth_google",
      additionalScopes: GOOGLE_CALENDAR_SCOPES,
      redirectUrl: "/controls",
    });
  });

  async function connectGithub() {
    if (!user) return;
    setGithubSyncError(null);
    try {
      const account = await createGithubExternalAccount();
      const redirectUrl = account?.verification?.externalVerificationRedirectURL;
      if (redirectUrl) {
        window.location.href = redirectUrl.toString();
      } else {
        console.error("[controls/github] createExternalAccount returned no redirect URL", account);
        setGithubSyncError("Couldn't start GitHub connection. Try again?");
      }
    } catch (error) {
      if (isReverificationCancelledError(error)) return;
      console.error("[controls/github] createExternalAccount failed", error);
      const message = isClerkAPIResponseError(error)
        ? error.errors[0]?.longMessage ?? error.errors[0]?.message
        : undefined;
      setGithubSyncError(message ?? "Couldn't start GitHub connection. Try again?");
    }
  }

  async function syncGithubNow() {
    setGithubSyncing(true);
    setGithubSyncError(null);
    const response = await fetch("/api/v1/integrations/github/sync", { method: "POST" }).catch(() => null);
    setGithubSyncing(false);
    if (!response?.ok) {
      setGithubSyncError("Sync failed. Try again?");
      return;
    }
    router.refresh();
  }

  async function connectGoogleCalendar() {
    if (!user) return;
    setGoogleCalendarConnectError(null);
    try {
      const account = await connectGoogleCalendarAccount();
      const redirectUrl = account?.verification?.externalVerificationRedirectURL;
      if (redirectUrl) {
        window.location.href = redirectUrl.toString();
      } else {
        console.error("[controls/google-calendar] connect/reauthorize returned no redirect URL", account);
        setGoogleCalendarConnectError("Couldn't start Google connection. Try again?");
      }
    } catch (error) {
      if (isReverificationCancelledError(error)) return;
      console.error("[controls/google-calendar] connect/reauthorize failed", error);
      const message = isClerkAPIResponseError(error)
        ? error.errors[0]?.longMessage ?? error.errors[0]?.message
        : undefined;
      setGoogleCalendarConnectError(message ?? "Couldn't start Google connection. Try again?");
    }
  }

  async function syncGoogleCalendarNow() {
    setGoogleCalendarSyncing(true);
    setGoogleCalendarSyncError(null);
    const response = await fetch("/api/v1/integrations/google-calendar/sync", { method: "POST" }).catch(() => null);
    setGoogleCalendarSyncing(false);
    if (!response?.ok) {
      setGoogleCalendarSyncError("Sync failed. Try again?");
      return;
    }
    router.refresh();
  }

  async function syncGoogleHealthNow() {
    setGoogleHealthSyncing(true);
    setGoogleHealthSyncError(null);
    const response = await fetch("/api/v1/integrations/google-health/sync", { method: "POST" }).catch(() => null);
    setGoogleHealthSyncing(false);
    if (!response?.ok) {
      setGoogleHealthSyncError("Sync failed. Try again?");
      return;
    }
    router.refresh();
  }

  const [tier1State, setTier1State] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TIER_1_ACTIONS.map((action) => [action.key, action.defaultOn])),
  );
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);
  const [readAloudEnabled, setReadAloudEnabled] = useState(false);

  const sourceByKey = new Map(sources.map((cursor) => [cursor.source as SourceKey, cursor]));

  return (
    <main className={styles.screen}>
      <div className={styles.eyebrow}>Controls</div>
      <div className={styles.acctHead}>
        <div className={styles.avLg}>{initialsFromEmail(email)}</div>
        <div className={styles.n}>
          <b>{name}</b>
          <em>{email}</em>
        </div>
      </div>

      <div className={styles.gtitle}>Sources</div>
      <div className={styles.card}>
        {SOURCES.map((source) => {
          const cursor = sourceByKey.get(source.key);
          const { detail, warn, soon } = describeSource(cursor);
          const isGithub = source.key === "github";
          const isGoogleCalendar = source.key === "calendar";
          const isGoogleHealth = source.key === "google_health";
          const googleRowConnected = isGoogleCalendar ? googleCalendarConnected : isGoogleHealth ? googleHealthConnected : false;
          const showConnected = (isGithub && githubConnected) || ((isGoogleCalendar || isGoogleHealth) && googleRowConnected);
          const syncError = isGithub
            ? githubSyncError
            : isGoogleCalendar
              ? googleCalendarSyncError
              : isGoogleHealth
                ? googleHealthSyncError
                : null;
          const connectError = isGoogleCalendar ? googleCalendarConnectError : null;

          return (
            <div className={styles.arow} key={source.key}>
              <div className={styles.srowIcon} style={{ background: source.color }}>
                {source.code}
              </div>
              <div className={styles.t}>
                <b>{source.label}</b>
                <em>
                  {showConnected
                    ? (cursor ? detail : "Connected, not yet synced")
                    : detail}
                  {syncError && ` — ${syncError}`}
                  {connectError && ` — ${connectError}`}
                </em>
              </div>
              {isGithub ? (
                githubConnected ? (
                  <button
                    type="button"
                    className={styles.actionpill}
                    onClick={syncGithubNow}
                    disabled={githubSyncing}
                  >
                    {githubSyncing ? "Syncing…" : "Sync now"}
                  </button>
                ) : (
                  <button type="button" className={styles.actionpill} onClick={connectGithub}>
                    Connect
                  </button>
                )
              ) : isGoogleCalendar ? (
                googleCalendarConnected ? (
                  <button
                    type="button"
                    className={styles.actionpill}
                    onClick={syncGoogleCalendarNow}
                    disabled={googleCalendarSyncing}
                  >
                    {googleCalendarSyncing ? "Syncing…" : "Sync now"}
                  </button>
                ) : (
                  <button type="button" className={styles.actionpill} onClick={connectGoogleCalendar}>
                    Connect
                  </button>
                )
              ) : isGoogleHealth ? (
                googleHealthConnected ? (
                  <button
                    type="button"
                    className={styles.actionpill}
                    onClick={syncGoogleHealthNow}
                    disabled={googleHealthSyncing}
                  >
                    {googleHealthSyncing ? "Syncing…" : "Sync now"}
                  </button>
                ) : (
                  // A plain navigation, not a Clerk call — Health's OAuth
                  // flow runs entirely outside Clerk (spec §9a).
                  <a href="/api/v1/integrations/google-health/authorize" className={styles.actionpill}>
                    Connect
                  </a>
                )
              ) : (
                <>
                  {warn && <div className={styles.warnpill}>Reconnect</div>}
                  {soon && <div className={styles.lockpill}>Soon</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
      {!githubConnected && sources.length === 0 && (
        <p className={styles.footnote}>
          Connecting sources is what I&rsquo;m being taught next. Until one is live there&rsquo;s
          nothing for me to read, so your Brief will stay quiet.
        </p>
      )}

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
  );
}
