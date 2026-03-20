"use client";

import { useEffect, useRef } from "react";
import type { DashboardStats, HeartbeatResponse } from "@/types/dashboard";

interface NotificationSetupProps {
  stats: DashboardStats | null;
  heartbeat: HeartbeatResponse | null;
}

/** Fires native notifications when dashboard state changes meaningfully. */
export default function NotificationSetup({ stats, heartbeat }: NotificationSetupProps) {
  const prevStats = useRef<DashboardStats | null>(null);
  const prevHeartbeat = useRef<HeartbeatResponse | null>(null);
  const permissionGranted = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      permissionGranted.current = true;
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        permissionGranted.current = perm === "granted";
      });
    }

    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Watch for meaningful stat changes and fire notifications
  useEffect(() => {
    if (!stats || !permissionGranted.current) return;

    // Only notify when tab is hidden (don't spam when user is looking at the dashboard)
    if (!document.hidden) {
      prevStats.current = stats;
      prevHeartbeat.current = heartbeat;
      return;
    }

    const prev = prevStats.current;
    const prevHb = prevHeartbeat.current;

    if (prev) {
      // Pending review increased
      if (stats.content.pendingReview > prev.content.pendingReview) {
        const count = stats.content.pendingReview;
        notify(
          `${count} post${count !== 1 ? "s" : ""} need your approval`,
          "Orbit submitted drafts for review",
          "pending-review"
        );
      }

      // Failed posts increased
      if (stats.content.failedPosts > prev.content.failedPosts) {
        const count = stats.content.failedPosts;
        const detail = stats.content.failedPostDetails[0]?.error ?? "Check the dashboard";
        notify(
          `${count} post${count !== 1 ? "s" : ""} failed`,
          detail,
          "failed-posts"
        );
      }

      // Service went down (was ok/degraded, now down)
      if (stats.health.lunary.status === "down" && prev.health.lunary.status !== "down") {
        notify("Lunary is DOWN", "Service became unreachable", "lunary-down");
      }
      if (stats.health.spellcast.status === "down" && prev.health.spellcast.status !== "down") {
        notify("Spellcast is DOWN", "Service became unreachable", "spellcast-down");
      }
      if (stats.health.contentCreator.status === "down" && prev.health.contentCreator.status !== "down") {
        notify("Content Creator is DOWN", "Service became unreachable", "cc-down");
      }

      // Orbit went offline
      if (stats.orbit && prev.orbit && !stats.orbit.online && prev.orbit.online) {
        notify("Orbit went offline", "Agent command centre unreachable", "orbit-offline");
      }

      // Orbit agent errors appeared
      if (stats.orbit?.errorAgents > 0 && (prev.orbit?.errorAgents ?? 0) === 0) {
        notify(
          `${stats.orbit.errorAgents} Orbit agent${stats.orbit.errorAgents !== 1 ? "s" : ""} failed`,
          "Agent pipeline has errors",
          "orbit-errors"
        );
      }
    }

    // Heartbeat: workstation went offline
    if (heartbeat?.status === "offline" && prevHb?.status !== "offline") {
      notify("Workstation offline", "MAC not responding", "mac-offline");
    }

    prevStats.current = stats;
    prevHeartbeat.current = heartbeat;
  }, [stats, heartbeat]);

  return null;
}

function notify(title: string, body: string, tag: string) {
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      tag, // Same tag replaces previous notification — prevents spam
    });
  } catch {
    // Notification API not available (e.g. insecure context)
  }
}
