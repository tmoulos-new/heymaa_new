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

export function NavIconChat() {
  return (
    <IconWrap>
      <path
        d="M19 4H7a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2v3l4.2-3H19a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Z"
        {...stroke}
      />
      <path d="M8 10h8M8 13.5h5.5" {...stroke} />
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

export function AppNavIcon({ id }: { id: AppNavTabId; active: boolean }) {
  const wrap = (node: React.ReactNode) => (
    <span style={{ color: "currentColor", display: "flex" }}>{node}</span>
  );
  switch (id) {
    case "profile":
      return wrap(<NavIconProfile />);
    case "family":
      return wrap(<NavIconFamily />);
    case "chat":
      return wrap(<NavIconChat />);
    case "memories":
      return wrap(<NavIconMemories />);
    case "milestones":
      return wrap(<NavIconMilestones />);
  }
}

/** Mic control styled like nav-tab active/inactive states. */
export function ChatMicIcon({ active }: { active: boolean }) {
  const color = active ? "#2B3A67" : "rgba(43,58,103,.38)";
  return <span style={{ color, display: "flex" }}><NavIconMic /></span>;
}

