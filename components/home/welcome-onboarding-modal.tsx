"use client";

import UserAvatar from "@/components/user-avatar";
import { getInterestLabel, INTEREST_OPTIONS, type InterestKey } from "@/lib/interests";

type SuggestedCreator = {
  id: string;
  name: string;
  handle: string;
  role: string;
  accountType?: "public" | "creator";
  avatarGradient: string;
  avatarUrl?: string;
  bio?: string;
  followerCount: number;
  sharedInterests: InterestKey[];
  interests: InterestKey[];
};

type WelcomeOnboardingModalProps = {
  open: boolean;
  userName: string;
  step: number;
  selectedInterests: InterestKey[];
  suggestedCreators: SuggestedCreator[];
  selectedFollowIds: string[];
  bio: string;
  avatarUrl: string;
  avatarUploading: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onChangeBio: (value: string) => void;
  onToggleInterest: (interest: InterestKey) => void;
  onToggleFollowUser: (userId: string) => void;
  onUploadAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
  onComplete: () => void;
};

const TOTAL_STEPS = 3;

export default function WelcomeOnboardingModal({
  open,
  userName,
  step,
  selectedInterests,
  suggestedCreators,
  selectedFollowIds,
  bio,
  avatarUrl,
  avatarUploading,
  saving,
  error,
  onClose,
  onBack,
  onNext,
  onChangeBio,
  onToggleInterest,
  onToggleFollowUser,
  onUploadAvatar,
  onRemoveAvatar,
  onComplete,
}: WelcomeOnboardingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!saving) {
          onClose();
        }
      }}
    >
      <section
        className="motion-surface w-full max-w-4xl p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Motion"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Welcome to Motion
            </p>
            <h2
              className="mt-1 text-2xl font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Let&apos;s set up your flow, {userName.split(" ")[0]}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              We&apos;ll personalize the feed, suggest a few people worth following, and help
              you finish the basics.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-slate-500"
            disabled={saving}
            aria-label="Close onboarding"
          >
            x
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => {
            const current = index + 1;
            return (
              <span
                key={current}
                className={`h-2.5 rounded-full transition ${
                  current === step
                    ? "w-10 bg-[var(--brand)]"
                    : current < step
                      ? "w-6 bg-[var(--brand)]/50"
                      : "w-6 bg-[var(--line)]"
                }`}
              />
            );
          })}
          <span className="ml-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        <div className="mt-5 min-h-[25rem]">
          {step === 1 ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--plain-bg)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Interests
                </p>
                <h3
                  className="mt-2 text-xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Tell Motion what to prioritize
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Pick at least one interest so your home feed opens with the right energy.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((option) => {
                    const active = selectedInterests.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onToggleInterest(option.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          active
                            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                            : "border-[var(--line)] bg-white text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[var(--line)] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  What changes
                </p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--plain-bg)] p-4">
                    <p className="text-sm font-semibold text-slate-900">Smarter home feed</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Posts and reels related to your interests get pushed up first.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--plain-bg)] p-4">
                    <p className="text-sm font-semibold text-slate-900">Better Explore picks</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Explore and creator suggestions will lean into the topics you care about.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Suggested creators
                </p>
                <h3
                  className="mt-2 text-xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Start with a few strong follows
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Follow creators now so your feed and messages feel alive immediately.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {suggestedCreators.map((creator) => {
                  const selected = selectedFollowIds.includes(creator.id);
                  return (
                    <article
                      key={creator.id}
                      className={`rounded-[1.5rem] border p-4 transition ${
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand)]/10"
                          : "border-[var(--line)] bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar
                          name={creator.name}
                          avatarGradient={creator.avatarGradient}
                          avatarUrl={creator.avatarUrl}
                          className="h-12 w-12 text-xs font-bold"
                          textClassName="text-xs font-bold text-white"
                          sizes="48px"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{creator.name}</p>
                            <span className="rounded-full border border-[var(--line)] bg-[var(--plain-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {creator.accountType === "creator" ? "Creator" : creator.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">@{creator.handle}</p>
                          {creator.bio ? (
                            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{creator.bio}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {creator.followerCount} followers
                            </span>
                            {creator.sharedInterests.length > 0 ? (
                              <span className="text-xs text-[var(--brand)]">
                                Shares {creator.sharedInterests.map(getInterestLabel).join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleFollowUser(creator.id)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            selected
                              ? "border border-[var(--line)] bg-white text-slate-700"
                              : "bg-[var(--brand)] text-white"
                          }`}
                        >
                          {selected ? "Following" : "Follow"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--plain-bg)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Complete your profile
                </p>
                <h3
                  className="mt-2 text-xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Add a face and a quick bio
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  This part is optional, but it makes follows and messages feel more real.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-[var(--line)] bg-white p-5">
                <div className="flex items-center gap-4">
                  <UserAvatar
                    name={userName}
                    avatarGradient="linear-gradient(135deg, #4facfe, #00f2fe)"
                    avatarUrl={avatarUrl || undefined}
                    className="h-[4.5rem] w-[4.5rem] text-sm font-bold"
                    textClassName="text-sm font-bold text-white"
                    sizes="72px"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
                      {avatarUploading ? "Uploading..." : "Choose profile photo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={avatarUploading || saving}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            onUploadAvatar(file);
                          }
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {avatarUrl ? (
                      <button
                        type="button"
                        onClick={onRemoveAvatar}
                        className="text-left text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Bio</span>
                    <span className="text-[10px] text-slate-500">{bio.length}/160</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={(event) => onChangeBio(event.target.value)}
                    className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm transition focus:border-[var(--brand)] focus:outline-none"
                    placeholder="Tell people what you shoot, build, or care about..."
                    maxLength={160}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 1 ? onClose : onBack}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            disabled={saving}
          >
            {step === 1 ? "Finish later" : "Back"}
          </button>
          <div className="flex items-center gap-2">
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={onNext}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Finishing..." : "Finish setup"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
