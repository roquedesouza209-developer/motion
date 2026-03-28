"use client";

import Image from "next/image";
import type { FormEvent, ReactNode } from "react";

type AuthMode = "signin" | "signup";

type RememberCandidate = {
  name: string;
};

type AuthScreenProps = {
  themePicker: ReactNode;
  authMode: AuthMode;
  authFirstName: string;
  authLastName: string;
  authUsername: string;
  email: string;
  password: string;
  authHint: string | null;
  error: string | null;
  rememberPromptOpen: boolean;
  rememberCandidate: RememberCandidate | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChangeAuthMode: (mode: AuthMode) => void;
  onChangeFirstName: (value: string) => void;
  onChangeLastName: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onRememberChoice: (shouldSave: boolean) => void;
  onClearFeedback: () => void;
};

export default function AuthScreen({
  themePicker,
  authMode,
  authFirstName,
  authLastName,
  authUsername,
  email,
  password,
  authHint,
  error,
  rememberPromptOpen,
  rememberCandidate,
  onSubmit,
  onChangeAuthMode,
  onChangeFirstName,
  onChangeLastName,
  onChangeUsername,
  onChangeEmail,
  onChangePassword,
  onRememberChoice,
  onClearFeedback,
}: AuthScreenProps) {
  return (
    <>
      <div className="auth-theme-toggle">{themePicker}</div>
      <div className="auth-grid">
        <div className="auth-stack">
          <main className="auth-card">
            <div className="auth-logo" style={{ fontFamily: "var(--font-heading)" }}>
              Motion
            </div>
            <p className="auth-tagline">
              {authMode === "signup"
                ? "Create an account to start sharing."
                : "Sign in to keep up with friends and creators."}
            </p>
            <form className="auth-form" onSubmit={onSubmit}>
              {authMode === "signup" ? (
                <>
                  <div className="auth-name-row">
                    <input
                      className="auth-input"
                      value={authFirstName}
                      onChange={(event) => onChangeFirstName(event.target.value)}
                      type="text"
                      placeholder="First name"
                    />
                    <input
                      className="auth-input"
                      value={authLastName}
                      onChange={(event) => onChangeLastName(event.target.value)}
                      type="text"
                      placeholder="Last name"
                    />
                  </div>
                  <input
                    className="auth-input"
                    value={authUsername}
                    onChange={(event) => onChangeUsername(event.target.value)}
                    type="text"
                    placeholder="Username"
                  />
                </>
              ) : null}
              <input
                className="auth-input"
                value={email}
                onChange={(event) => onChangeEmail(event.target.value)}
                type="email"
                placeholder={
                  authMode === "signup" ? "Email address" : "Email address or username"
                }
              />
              {authMode === "signup" ? (
                <p className="auth-help">Email address is not shown on your profile.</p>
              ) : null}
              <input
                className="auth-input"
                value={password}
                onChange={(event) => onChangePassword(event.target.value)}
                type="password"
                placeholder="Password"
              />
              <button className="auth-button" type="submit">
                {authMode === "signup" ? "Sign Up" : "Sign In"}
              </button>
            </form>
            <div className="auth-divider">
              <span>OR</span>
            </div>
            {authHint ? <p className="auth-hint">{authHint}</p> : null}
            {error ? <p className="auth-error">{error}</p> : null}
          </main>
          <div className="auth-card auth-card-sub">
            {authMode === "signup" ? (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-inline-button"
                  onClick={() => {
                    onClearFeedback();
                    onChangeAuthMode("signin");
                  }}
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="auth-inline-button"
                  onClick={() => {
                    onClearFeedback();
                    onChangeAuthMode("signup");
                  }}
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="auth-preview" aria-hidden="true">
          <section className="auth-showcase auth-showcase-photo-panel">
            <div className="auth-showcase-glow auth-showcase-glow-primary" />
            <div className="auth-showcase-glow auth-showcase-glow-secondary" />
            <div className="auth-showcase-frame">
              <Image
                src="/auth/sign-up-hero.png"
                alt="Stylized portrait for Motion sign in"
                fill
                priority
                sizes="(max-width: 920px) 100vw, 50vw"
                className="auth-showcase-frame-image"
              />
              <div className="auth-showcase-frame-shade" />
            </div>
          </section>
        </div>
      </div>

      {rememberPromptOpen && rememberCandidate ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm"
          onClick={() => onRememberChoice(false)}
        >
          <section
            className="auth-remember-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Save your login"
          >
            <div className="auth-remember-avatar">
              {rememberCandidate.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
            <h2>Save your login info?</h2>
            <p>We can save your login details so you can quickly switch accounts.</p>
            <div className="auth-remember-actions">
              <button
                type="button"
                className="auth-remember-secondary"
                onClick={() => onRememberChoice(false)}
              >
                Not now
              </button>
              <button
                type="button"
                className="auth-remember-primary"
                onClick={() => onRememberChoice(true)}
              >
                Save info
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
