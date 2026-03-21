import fs from "fs";
import path from "path";

export interface MetricsSnapshot {
  dau: number;
  mau: number;
  wau: number;
  mrr: number;
  signups7d: number;
  updatedAt: string;
}

export const SNAPSHOT_PATH = path.join("/app/data", "metrics-snapshot.json");

export function writeMetricsSnapshot(
  metrics: { dau?: number; mau?: number; wau?: number; mrr?: number; signups7d?: number },
  ts: string
): void {
  try {
    const dir = path.dirname(SNAPSHOT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const snapshot: MetricsSnapshot = {
      dau: Number(metrics.dau ?? 0),
      mau: Number(metrics.mau ?? 0),
      wau: Number(metrics.wau ?? 0),
      mrr: Number(metrics.mrr ?? 0),
      signups7d: Number(metrics.signups7d ?? 0),
      updatedAt: ts,
    };
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Non-fatal: snapshot write failure should not break the heartbeat
  }
}

export function readMetricsSnapshot(): MetricsSnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    return JSON.parse(raw) as MetricsSnapshot;
  } catch {
    return null;
  }
}
