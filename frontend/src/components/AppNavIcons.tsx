import React from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Minimal line-art icons matching the reference bottom-nav style. */
export function NavIconProfile() {
  return (
    <IconWrap>
      <circle cx="12" cy="8" r="3.25" {...stroke} />
      <path d="M5.5 19.5c1.2-3.2 3.3-4.8 6.5-4.8s5.3 1.6 6.5 4.8" {...stroke} />
    </IconWrap>
  );
}

export function NavIconFamily() {
  return (
    <IconWrap>
      <circle cx="9" cy="8" r="2.6" {...stroke} />
      <circle cx="16" cy="9" r="2.2" {...stroke} />
      <path d="M3.8 19c.9-2.8 2.6-4.2 5.2-4.2 1.5 0 2.7.5 3.6 1.3" {...stroke} />
      <path d="M12.8 19c.7-2.2 2-3.3 4-3.3 1.8 0 3 .9 3.7 2.6" {...stroke} />
    </IconWrap>
  );
}

export function NavIconHeyMaa() {
  return (
    <IconWrap>
      <path
        d="M5.5 15.2V9.4c0-3.1 2.7-5.6 6.5-5.6s6.5 2.5 6.5 5.6-2.7 5.6-6.5 5.6c-.7 0-1.4-.1-2-.2L6.2 17.6c-.4.2-.8-.2-.6-.6l1-1.8Z"
        {...stroke}
      />
      <path d="M10 9.2v3.2M12 8.4v4.8M14 9.2v3.2" {...stroke} />
    </IconWrap>
  );
}

export function NavIconMemories() {
  return (
    <IconWrap>
      <path
        d="M12 19.2c-.4 0-6.8-4.1-8.2-8.1C2.6 8.1 4.2 5.5 7 5.5c1.6 0 2.8.8 3.5 1.9.7-1.1 1.9-1.9 3.5-1.9 2.8 0 4.4 2.6 3.2 5.6-1.4 4-7.8 8.1-8.2 8.1Z"
        {...stroke}
      />
    </IconWrap>
  );
}

export function NavIconMilestones() {
  return (
    <IconWrap>
      <path d="M7 20.5V5.5" {...stroke} />
      <path d="M7 5.5h8.2l-1.6 3.1 1.6 3.1H7" {...stroke} />
    </IconWrap>
  );
}

export function NavIconMic() {
  return (
    <IconWrap>
      <path d="M12 3.5c-1.5 0-2.7 1.2-2.7 2.7v6.1c0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.7V6.2c0-1.5-1.2-2.7-2.7-2.7Z" {...stroke} />
      <path d="M7.2 11.2a4.8 4.8 0 0 0 9.6 0" {...stroke} />
      <path d="M12 16v3.2M9.2 19.2h5.6" {...stroke} />
    </IconWrap>
  );
}

export type AppNavTabId = "profile" | "family" | "chat" | "memories" | "milestones";

export function AppNavIcon({ id, active }: { id: AppNavTabId; active: boolean }) {
  const color = active ? "#2B3A67" : "rgba(43,58,103,.38)";
  switch (id) {
    case "profile":
      return <span style={{ color, display: "flex" }}><NavIconProfile /></span>;
    case "family":
      return <span style={{ color, display: "flex" }}><NavIconFamily /></span>;
    case "chat":
      return <span style={{ color: "#fff", display: "flex" }}><NavIconHeyMaa /></span>;
    case "memories":
      return <span style={{ color, display: "flex" }}><NavIconMemories /></span>;
    case "milestones":
      return <span style={{ color, display: "flex" }}><NavIconMilestones /></span>;
  }
}

/** Mic control styled like nav-tab active/inactive states. */
export function ChatMicIcon({ active }: { active: boolean }) {
  const color = active ? "#2B3A67" : "rgba(43,58,103,.38)";
  return <span style={{ color, display: "flex" }}><NavIconMic /></span>;
}

