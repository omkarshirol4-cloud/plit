"use client";

import { useEffect } from "react";
import type { UnlockedAchievement } from "@/lib/types";

/**
 * AchievementToast — announces just-unlocked achievements.
 *
 * The server decides what unlocked; this only displays `unlockedNow` handed to
 * it. It never computes an unlock itself, so it cannot announce anything the
 * ledger did not actually pay for.
 */
export function AchievementToast({
  unlocked,
  onDismiss,
}: {
  unlocked: UnlockedAchievement[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (unlocked.length === 0) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [unlocked, onDismiss]);

  if (unlocked.length === 0) return null;

  return (
    <div className="ach-toasts" role="status" aria-live="polite">
      {unlocked.map((a) => (
        <div className="ach-toast" key={a.code}>
          <div className="ach-toast-icon" aria-hidden="true">
            &#9733;
          </div>
          <div className="ach-toast-body">
            <div className="ach-toast-title">Achievement unlocked</div>
            <div className="ach-toast-name">
              {a.title} <span className="ach-toast-reward">+{a.tokenReward} tokens</span>
            </div>
            <div className="ach-toast-desc">{a.description}</div>
          </div>
          <button className="ach-toast-close" onClick={onDismiss} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * sessionStorage handoff for the assessment submit -> result navigation.
 *
 * `router.push` is a client-side transition, so the newly unlocked achievements
 * would otherwise be lost between pages. Keyed by candidate so two candidates
 * sharing a tab cannot see each other's banners. Read once, then cleared, so a
 * refresh does not replay a stale notification.
 */
const KEY = "hr.unlockedPending";

export function stashUnlocked(candidateId: string, list: UnlockedAchievement[]) {
  if (typeof window === "undefined" || list.length === 0) return;
  try {
    window.sessionStorage.setItem(`${KEY}:${candidateId}`, JSON.stringify(list));
  } catch {
    /* private mode / quota — the rewards page still shows the unlock */
  }
}

export function takeUnlocked(candidateId: string): UnlockedAchievement[] {
  if (typeof window === "undefined") return [];
  const k = `${KEY}:${candidateId}`;
  try {
    const raw = window.sessionStorage.getItem(k);
    if (!raw) return [];
    window.sessionStorage.removeItem(k);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UnlockedAchievement[]) : [];
  } catch {
    return [];
  }
}
