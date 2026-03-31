"use client";

type OnboardingBannerProps = {
  showProfilePrompt: boolean;
  followsCount: number;
  selectedInterestsCount: number;
  onOpen: () => void;
};

export default function OnboardingBanner({
  showProfilePrompt,
  followsCount,
  selectedInterestsCount,
  onOpen,
}: OnboardingBannerProps) {
  return (
    <section className="motion-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Welcome Setup
          </p>
          <h2
            className="mt-1 text-xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Finish setting up Motion
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            A stronger start gives you a better feed, better creator suggestions, and a profile
            that feels ready when people find you.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Continue setup
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
          <p className="text-lg font-semibold text-slate-900">{selectedInterestsCount}</p>
          <p className="text-xs text-slate-500">Interests selected</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
          <p className="text-lg font-semibold text-slate-900">{followsCount}</p>
          <p className="text-xs text-slate-500">Creators followed</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
          <p className="text-lg font-semibold text-slate-900">
            {showProfilePrompt ? "Needs work" : "Ready"}
          </p>
          <p className="text-xs text-slate-500">Profile basics</p>
        </div>
      </div>
    </section>
  );
}
