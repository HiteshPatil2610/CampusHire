"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

import "./auth-shell.css";

type AuthMode = "in" | "up";

const PATH: Record<AuthMode, string> = { in: "/sign-in", up: "/sign-up" };

/** How long the outgoing form stays mounted — long enough to finish sliding under the tile. */
const SLIDE_MS = 900;

const stagger = (i: 1 | 2 | 3) => ({ "--i": i }) as CSSProperties;

/** React 18 has no `inert` prop, so set the DOM property directly. */
function useInert(ref: RefObject<HTMLElement | null>, inert: boolean) {
  useEffect(() => {
    if (ref.current) ref.current.inert = inert;
  }, [ref, inert]);
}

/**
 * Sign In / Sign Up screen. Lives in the app/(auth)/(split) layout so it stays mounted
 * across /sign-in ↔ /sign-up, which is what lets the tile and forms animate.
 *
 * Clerk's components use hash routing so both can be on screen during the
 * slide. The inactive one is unmounted once hidden, so the two never fight
 * over the URL hash during multi-step flows (email code, reset password).
 */
export function AuthShell() {
  const pathname = usePathname();
  const router = useRouter();
  const mode: AuthMode = pathname.startsWith(PATH.up) ? "up" : "in";
  const up = mode === "up";

  const [outgoing, setOutgoing] = useState<AuthMode | null>(null);
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setOutgoing(prevMode);
  }

  useEffect(() => {
    if (!outgoing) return;
    const t = setTimeout(() => setOutgoing(null), SLIDE_MS);
    return () => clearTimeout(t);
  }, [outgoing]);

  const signInPanel = useRef<HTMLElement>(null);
  const signUpPanel = useRef<HTMLElement>(null);
  const signInCopy = useRef<HTMLDivElement>(null);
  const signUpCopy = useRef<HTMLDivElement>(null);
  useInert(signInPanel, up);
  useInert(signUpPanel, !up);
  useInert(signUpCopy, up);
  useInert(signInCopy, !up);

  const showSignIn = !up || outgoing === "in";
  const showSignUp = up || outgoing === "up";

  // Keep ?redirect_url (set by middleware) when switching forms.
  const switchTo = (next: AuthMode) => router.push(PATH[next] + window.location.search, { scroll: false });

  return (
    <div className="auth-shell">
      <div className="auth-bezel">
        <div className="auth-bezel__sweep" aria-hidden />
        <div className="auth-card" data-mode={mode}>
          <div className="auth-card__inset" aria-hidden />
          <div className="auth-card__grid" aria-hidden>
            <span /><span /><span /><span /><span /><span />
          </div>

          <section ref={signInPanel} className={`auth-panel${up ? "" : " is-active"}`} aria-labelledby="sign-in-title">
            <div className="auth-form">
              <div className="auth-form__head">
                <span className="auth-form__eyebrow">Welcome Back</span>
                <h1 id="sign-in-title" className="auth-form__title">Sign In</h1>
                <p className="auth-form__lede">Continue with your university account or email.</p>
              </div>
              {showSignIn && <SignIn routing="hash" signUpUrl={PATH.up} />}
            </div>
          </section>

          <section ref={signUpPanel} className={`auth-panel${up ? " is-active" : ""}`} aria-labelledby="sign-up-title">
            <div className="auth-form">
              <div className="auth-form__head">
                <span className="auth-form__eyebrow">New Here</span>
                <h1 id="sign-up-title" className="auth-form__title">Create Account</h1>
                <p className="auth-form__lede">Register with Google or your email address.</p>
              </div>
              {showSignUp && <SignUp routing="hash" signInUrl={PATH.in} />}
            </div>
          </section>

          <div className="auth-tile">
            <div className="auth-tile__surface">
              <div className="auth-tile__brand">CampusHire</div>

              <div ref={signUpCopy} className={`tile-copy${up ? "" : " is-active"}`}>
                <h2 className="tile-copy__item tile-copy__title" style={stagger(1)}>
                  New to CampusHire? Your Place Begins Here.
                </h2>
                <p className="tile-copy__item tile-copy__text" style={stagger(2)}>
                  Create an account to track applications, save programmes and join events.
                </p>
                <div className="tile-copy__item" style={stagger(3)}>
                  <button type="button" className="tile-btn" onClick={() => switchTo("up")}>
                    Create Account
                  </button>
                </div>
              </div>

              <div ref={signInCopy} className={`tile-copy${up ? " is-active" : ""}`}>
                <h2 className="tile-copy__item tile-copy__title" style={stagger(1)}>
                  Welcome Back to a Legacy of Excellence.
                </h2>
                <p className="tile-copy__item tile-copy__text" style={stagger(2)}>
                  Already have an account? Sign in with your email and password.
                </p>
                <div className="tile-copy__item" style={stagger(3)}>
                  <button type="button" className="tile-btn" onClick={() => switchTo("in")}>
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
