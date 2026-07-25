import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ConnectBankButton } from "@/components/ConnectBankButton";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="btn ghost sm">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn primary sm">Sign up</button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <ConnectBankButton />
          <UserButton />
        </Show>
      </div>
      <p className="sec-title">Design system check</p>
      <div className="card pad">
        <h1 className="serif" style={{ fontSize: 32 }}>
          Safe-to-Pay Number
        </h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
          Tokens, typography, and primitives ported from the prototype are
          wired into this Next.js app.
        </p>
        <p className="mono" style={{ fontSize: 40, marginTop: 20 }}>
          $3,650
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
          <span className="pill ok">
            <span className="pdot" /> Taxes funded
          </span>
          <span className="pill warn">
            <span className="pdot" /> Runway at risk
          </span>
          <span className="pill neutral">
            <span className="pdot" /> Draft
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="btn primary">Confirm</button>
          <button className="btn ghost">Dismiss</button>
        </div>
        <p className="disclaimer" style={{ marginTop: 26 }}>
          Estimates — confirm with your accountant.
        </p>
      </div>
    </main>
  );
}
