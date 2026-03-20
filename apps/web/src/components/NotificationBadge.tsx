"use client";

export default function NotificationBadge() {
  return (
    <div
      className="notification-badge"
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        background: "#ef4444",
        border: "2px solid #000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        imageRendering: "pixelated",
      }}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "#fff",
          lineHeight: 1,
          textShadow: "0 0 4px rgba(239,68,68,0.8)",
        }}
      >
        !
      </span>
    </div>
  );
}
