"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { currentTimeZone, describeTimeZone, listTimeZones } from "@/lib/timezone";
import { OttoMark } from "@/components/otto/OttoMark";
import styles from "./WelcomeView.module.css";

const STEPS = 3;
const AFTER_WELCOME_URL = "/controls";

type Step = 0 | 1 | 2;

// The zone is a browser fact the server cannot know, so it is read as external
// state rather than during render — the server snapshot is empty, and the card
// simply has no zone row until hydration fills it in.
const NEVER_CHANGES = () => () => {};

export function WelcomeView({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(suggestedName);
  const [role, setRole] = useState("");
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const [changingZone, setChangingZone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedZone = useSyncExternalStore(NEVER_CHANGES, currentTimeZone, () => "");
  const zone = chosenZone ?? detectedZone;

  const zones = useMemo(() => (changingZone ? listTimeZones() : []), [changingZone]);
  const described = zone ? describeTimeZone(zone) : null;
  const firstName = name.trim().split(/\s+/)[0];

  const finish = async () => {
    setError(null);
    setPending(true);

    const response = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: name.trim(),
        role: role.trim() || null,
        timezone: zone || null,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setPending(false);
      setError("I couldn't save that. Try again?");
      return;
    }

    // The tab screens read displayName off the server, so the cached render has
    // to be dropped before we navigate or the first Brief still says nothing.
    router.refresh();
    router.push(AFTER_WELCOME_URL);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 0) {
      if (!name.trim()) return;
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else {
      void finish();
    }
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.steps}>
          {Array.from({ length: STEPS }, (_, index) => (
            <i key={index} data-on={index <= step} />
          ))}
        </div>

        {step === 0 && (
          <div className={styles.body}>
            <OttoMark />
            <h1 className={styles.headline}>Hi &mdash; I&rsquo;m {ASSISTANT_NAME}.</h1>
            <p className={styles.sub}>
              I keep track of what you&rsquo;ve promised and tell you what&rsquo;s actually at
              risk. First &mdash; what should I call you?
            </p>

            <div className={styles.field}>
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                autoFocus
                autoComplete="name"
                value={name}
                placeholder="Your name"
                onChange={(event) => setName(event.target.value)}
              />
              <p className={styles.hint}>
                {suggestedName
                  ? "From the account you signed up with. Change it if you'd rather."
                  : "However you'd like to be spoken to."}
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={styles.body}>
            <h1 className={styles.headline}>
              And what do
              <br />
              you do{firstName ? `, ${firstName}` : ""}?
            </h1>
            <p className={styles.sub}>
              One line is plenty. It helps me tell a real promise from an aside.
            </p>

            <div className={styles.field}>
              <label htmlFor="role">What you do</label>
              <input
                id="role"
                data-size="mid"
                autoFocus
                value={role}
                placeholder="Corporate lawyer at Sidley"
                onChange={(event) => setRole(event.target.value)}
              />
            </div>

            {changingZone ? (
              <select
                className={styles.zoneSelect}
                aria-label="Time zone"
                value={zone}
                onChange={(event) => {
                  setChosenZone(event.target.value);
                  setChangingZone(false);
                }}
              >
                {zones.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            ) : (
              described && (
                <div className={styles.derived}>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="var(--hr-ink-3)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ flex: "0 0 16px" }}
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="8.6" />
                    <path d="M12 7.4V12l3.2 1.9" />
                  </svg>
                  <div className={styles.zone}>
                    <b>{described.city}</b>
                    {described.offset && ` · ${described.offset}`}
                  </div>
                  <button
                    type="button"
                    className={styles.change}
                    onClick={() => setChangingZone(true)}
                  >
                    Change
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {step === 2 && (
          <div className={styles.body}>
            <h1 className={styles.headline}>
              Good to meet
              <br />
              you{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className={styles.sub}>
              I don&rsquo;t know anything about your week yet. Here&rsquo;s how that changes.
            </p>

            <ol className={styles.next}>
              <li>
                <span className={styles.n}>1</span>
                {/* Explicit {" "} after each </b>: JSX drops the space when the
                    text that follows wraps onto the next source line. */}
                <span>
                  <b>You connect a source.</b>{" "}
                  Gmail, Calendar, GitHub &mdash; whichever you actually live in.
                </span>
              </li>
              <li>
                <span className={styles.n}>2</span>
                <span>
                  <b>I read the last 90 days</b>{" "}
                  and pull out every promise I can find, with a quote for each one.
                </span>
              </li>
              <li>
                <span className={styles.n}>3</span>
                <span>
                  <b>You tell me which ones I got wrong.</b>{" "}
                  That&rsquo;s the whole way I get sharper.
                </span>
              </li>
            </ol>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.foot}>
          <button
            type="submit"
            className={styles.submit}
            disabled={pending || (step === 0 && !name.trim())}
          >
            {step === 2 ? "Connect my first source" : "Continue"}
          </button>

          {step === 1 && (
            <button type="button" className={styles.skip} onClick={() => setStep(2)}>
              Skip for now
            </button>
          )}

          {step === 2 && (
            <p className={styles.note}>
              I only ever read. Nothing gets sent on your behalf without you tapping send.
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
