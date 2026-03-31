"use client";

import Link from "next/link";

import FollowingTopicsSettings from "@/components/profile/following-topics-settings";
import type { InterestKey } from "@/lib/interests";

type FeedVisibility = "everyone" | "followers" | "non_followers" | "custom";
type AccountType = "public" | "creator";

type UserSearchResult = {
  id: string;
  name: string;
  handle: string;
};

type PrivacySettingsModalProps = {
  open: boolean;
  currentAccountType: AccountType;
  effectiveAccountType: AccountType;
  selectedAccountType: AccountType;
  interests: InterestKey[];
  visibility: FeedVisibility;
  hiddenIds: string[];
  restrictedAccount: boolean;
  userSearchQuery: string;
  userSearchResults: UserSearchResult[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSelectAccountType: (value: AccountType) => void;
  onChangeInterests: (value: InterestKey[]) => void;
  onChangeVisibility: (value: FeedVisibility) => void;
  onChangeRestrictedAccount: (value: boolean) => void;
  onChangeUserSearchQuery: (value: string) => void;
  onAddHiddenUser: (userId: string) => void;
  onRemoveHiddenUser: (userId: string) => void;
  onClearUserSearch: () => void;
  onSave: () => void;
};

export default function PrivacySettingsModal({
  open,
  currentAccountType,
  effectiveAccountType,
  selectedAccountType,
  interests,
  visibility,
  hiddenIds,
  restrictedAccount,
  userSearchQuery,
  userSearchResults,
  saving,
  error,
  onClose,
  onSelectAccountType,
  onChangeInterests,
  onChangeVisibility,
  onChangeRestrictedAccount,
  onChangeUserSearchQuery,
  onAddHiddenUser,
  onRemoveHiddenUser,
  onClearUserSearch,
  onSave,
}: PrivacySettingsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!saving) {
          onClose();
        }
      }}
    >
      <section
        className="motion-surface w-full max-w-lg p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Switch account type and control who can see your posts and reels.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Account Type</p>
                <p className="mt-1 text-sm text-slate-500">
                  Public accounts can upgrade to Creator for analytics and audience insights.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {currentAccountType === "creator" ? "Creator" : "Public"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={currentAccountType === "creator"}
                onClick={() => onSelectAccountType("public")}
                className={`rounded-2xl border p-4 text-left transition ${
                  effectiveAccountType === "public"
                    ? "border-[var(--brand)] bg-[var(--brand)]/8"
                    : "border-[var(--line)] bg-white"
                } ${
                  currentAccountType === "creator"
                    ? "cursor-not-allowed opacity-60"
                    : "hover:border-[var(--brand)]"
                }`}
                aria-pressed={effectiveAccountType === "public"}
              >
                <p className="text-sm font-semibold text-slate-900">Public Account</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Standard profile with posting, messaging, and privacy controls.
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {currentAccountType === "creator" ? "Unavailable after upgrade" : "Current option"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectAccountType("creator")}
                className={`rounded-2xl border p-4 text-left transition ${
                  effectiveAccountType === "creator"
                    ? "border-[var(--brand)] bg-[var(--brand)]/8"
                    : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
                }`}
                aria-pressed={effectiveAccountType === "creator"}
              >
                <p className="text-sm font-semibold text-slate-900">Creator Account</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Unlock analytics, audience insights, and creator-focused growth tools.
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
                  {currentAccountType === "creator" ? "Active now" : "One-way upgrade"}
                </p>
              </button>
            </div>

            {currentAccountType !== "creator" && selectedAccountType === "creator" ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Upgrading to Creator is permanent in Motion. You will not be able to switch back to Public.
              </p>
            ) : null}
          </div>

          {effectiveAccountType === "creator" ? (
            <div className="rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/8 p-4">
              <div className="flex flex-col gap-4">
                <div className="max-w-md">
                  <p className="text-sm font-semibold text-slate-900">Creator tools</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Your analytics and internal support queue now live in dedicated spaces
                    instead of being crammed into Settings.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/creator-studio"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 16h14" />
                      <path d="M5 13V8" />
                      <path d="M10 13V4" />
                      <path d="M15 13v-6" />
                    </svg>
                    Open Creator Studio
                  </Link>
                  <Link
                    href="/support-requests"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--brand)]/25 bg-white px-5 text-sm font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 16.5c3.8 0 6.9-2.8 6.9-6.2S13.8 4.1 10 4.1 3.1 6.9 3.1 10.3c0 1.3.5 2.6 1.4 3.5L4.2 16l2.2-.6c1 .7 2.3 1.1 3.6 1.1Z" />
                      <path d="M7.1 8.8h5.8" />
                      <path d="M7.1 11.4h4.1" />
                    </svg>
                    Open Support Inbox
                  </Link>
                </div>
              </div>
            </div>
          ) : selectedAccountType === "creator" ? (
            <div className="rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/8 p-4">
              <p className="text-sm font-semibold text-slate-900">Creator Studio unlocks after upgrade</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Save this change first, then you will get a dedicated creator dashboard
                with views, engagement, follower growth, and audience activity.
              </p>
            </div>
          ) : null}

          <FollowingTopicsSettings interests={interests} onChange={onChangeInterests} />

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Visible To</label>
            <select
              value={visibility}
              onChange={(event) => onChangeVisibility(event.target.value as FeedVisibility)}
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm transition focus:border-[var(--brand)] focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              <option value="followers">Followers Only</option>
              <option value="non_followers">Non-Followers Only</option>
              <option value="custom">Custom (Hide from specific users)</option>
            </select>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Restricted account</p>
                <p className="mt-1 text-sm text-slate-500">
                  Only followers can message or call you when this is turned on.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeRestrictedAccount(!restrictedAccount)}
                className={`inline-flex h-7 w-12 items-center rounded-full border px-1 transition ${
                  restrictedAccount
                    ? "border-[var(--brand)] bg-[var(--brand)]"
                    : "border-[var(--line)] bg-slate-200"
                }`}
                aria-pressed={restrictedAccount}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition ${
                    restrictedAccount ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {visibility === "custom" ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Hide from these users
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(event) => onChangeUserSearchQuery(event.target.value)}
                  placeholder="Search users..."
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm transition focus:border-[var(--brand)] focus:outline-none"
                />
                {userSearchResults.length > 0 ? (
                  <div className="absolute left-0 right-0 top-11 z-10 max-h-48 overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-lg">
                    {userSearchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          onAddHiddenUser(user.id);
                          onClearUserSearch();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm font-semibold">@{user.handle}</span>
                        <span className="text-xs text-slate-500">{user.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {hiddenIds.length > 0 ? (
                <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
                  {hiddenIds.map((id) => (
                    <div
                      key={id}
                      className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-slate-700"
                    >
                      <span>User ID: {id}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveHiddenUser(id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-slate-700"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="h-10 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
