"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import styles from "./sign-up.module.css";

const POST_SIGN_UP_URL = "/brief";
const SSO_CALLBACK_URL = "/sign-up/sso-callback";
const GENERIC_ERROR = "Something went wrong. Try again.";

type Mode = "start" | "email" | "verify";
type OAuthProvider = "oauth_google" | "oauth_github";

// Clerk puts the user-facing reason on the first entry of `.errors`, not on
// the response error itself — reading `.longMessage` directly silently
// falls back to the generic message even when Clerk explains what happened.
function readableError(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.longMessage ?? GENERIC_ERROR;
  }
  return GENERIC_ERROR;
}

export function SignUpView() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<Mode>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startOAuth = async (strategy: OAuthProvider) => {
    setError(null);
    setPending(true);
    const { error: ssoError } = await signUp.sso({
      strategy,
      redirectUrl: POST_SIGN_UP_URL,
      redirectCallbackUrl: SSO_CALLBACK_URL,
    });
    if (ssoError) {
      setError(readableError(ssoError));
      setPending(false);
    }
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error: passwordError } = await signUp.password({ emailAddress: email, password });
    if (passwordError) {
      setError(readableError(passwordError));
      setPending(false);
      return;
    }

    if (signUp.status === "complete") {
      await signUp.finalize();
      router.push(POST_SIGN_UP_URL);
      return;
    }

    const { error: codeError } = await signUp.verifications.sendEmailCode();
    setPending(false);
    if (codeError) {
      setError(readableError(codeError));
      return;
    }
    setMode("verify");
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) {
      setError("That code didn't work. Check your email and try again.");
      setPending(false);
      return;
    }

    await signUp.finalize();
    router.push(POST_SIGN_UP_URL);
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <i className={styles.mark} />
          <b className={styles.brandName}>Headroom</b>
        </div>

        {mode === "start" && (
          <>
            <h1 className={styles.headline}>
              Nothing you
              <br />
              promised falls
              <br />
              through.
            </h1>
            <p className={styles.sub}>
              Headroom reads your email, calendar, and code, finds every commitment
              you&rsquo;ve made, and tells you what&rsquo;s actually at risk — with the work
              already drafted.
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.provider} ${styles.providerPrimary}`}
                disabled={pending}
                onClick={() => void startOAuth("oauth_google")}
              >
                <span className={styles.providerIcon} style={{ background: "rgba(255,255,255,.22)" }}>
                  G
                </span>
                Continue with Google
              </button>
              <button
                type="button"
                className={styles.provider}
                disabled={pending}
                onClick={() => void startOAuth("oauth_github")}
              >
                <span className={styles.providerIcon} style={{ background: "#181717" }}>
                  GH
                </span>
                Continue with GitHub
              </button>
              <div className={styles.orLine}>or</div>
              <button
                type="button"
                className={styles.provider}
                disabled={pending}
                onClick={() => setMode("email")}
              >
                Continue with email
              </button>
            </div>

            <p className={styles.legal}>
              Google and GitHub are also two of your data sources — signing in with one
              means one less connection later.
              <br />
              <br />
              By continuing you agree to the <a href="/terms">Terms</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </>
        )}

        {mode === "email" && (
          <>
            <h1 className={styles.headline}>Create your account.</h1>
            <form className={styles.form} onSubmit={(event) => void submitEmail(event)}>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button type="submit" className={styles.submit} disabled={pending}>
                Continue
              </button>
            </form>
            <button type="button" className={styles.back} onClick={() => setMode("start")}>
              Back
            </button>
          </>
        )}

        {mode === "verify" && (
          <>
            <h1 className={styles.headline}>Check your email.</h1>
            <p className={styles.sub}>We sent a code to {email}.</p>
            <form className={styles.form} onSubmit={(event) => void submitCode(event)}>
              <div className={styles.field}>
                <label htmlFor="code">Verification code</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <button type="submit" className={styles.submit} disabled={pending}>
                Verify
              </button>
            </form>
            <button type="button" className={styles.back} onClick={() => setMode("email")}>
              Back
            </button>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.footer}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>

        {/* Custom flows must render this mount point themselves, or Clerk's bot-protection widget falls back with a console error. */}
        <div id="clerk-captcha" />
      </div>
    </main>
  );
}
