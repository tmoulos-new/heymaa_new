import type { ReactNode } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function RailIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconCirclePlus() {
  // Circle + plus reads more clearly as “new conversation” than a pen.
  return (
    <RailIcon>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 8v8M8 12h8" {...stroke} />
    </RailIcon>
  );
}

function IconSearch() {
  return (
    <RailIcon>
      <circle cx="11" cy="11" r="6.25" {...stroke} />
      <path d="M16 16l4.2 4.2" {...stroke} />
    </RailIcon>
  );
}

function IconImages() {
  return (
    <RailIcon>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" {...stroke} />
      <circle cx="9" cy="10.2" r="1.35" fill="currentColor" />
      <path d="M3.5 15.5l4.4-4.2 3.2 3 3.1-3.4 6.3 5.6" {...stroke} />
    </RailIcon>
  );
}

function IconSources() {
  return (
    <RailIcon>
      <path d="M12 7.2C10.5 6.1 8.6 5.5 6.5 5.5H4.2v12.2h2.3c2.1 0 4 .6 5.5 1.7" {...stroke} />
      <path d="M12 7.2c1.5-1.1 3.4-1.7 5.5-1.7h2.3v12.2h-2.3c-2.1 0-4 .6-5.5 1.7" {...stroke} />
      <path d="M12 7.2v12.2" {...stroke} />
    </RailIcon>
  );
}

type RailItem = {
  key: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
};

export function ChatIconRail({
  railAriaLabel,
  newChatLabel,
  searchLabel,
  libraryLabel,
  onNewChat,
  onSearch,
  onLibrary,
  newChatDisabled,
  sourcesLabel,
  sourcesCount,
  onSources,
}: {
  railAriaLabel: string;
  newChatLabel: string;
  searchLabel: string;
  libraryLabel: string;
  onNewChat: () => void;
  onSearch: () => void;
  onLibrary: () => void;
  newChatDisabled?: boolean;
  sourcesLabel?: string;
  sourcesCount?: number;
  onSources?: () => void;
}) {
  const items: RailItem[] = [
    { key: "new", label: newChatLabel, onClick: onNewChat, disabled: newChatDisabled, icon: <IconCirclePlus /> },
    { key: "search", label: searchLabel, onClick: onSearch, icon: <IconSearch /> },
    { key: "library", label: libraryLabel, onClick: onLibrary, icon: <IconImages /> },
  ];
  if (onSources && (sourcesCount || 0) > 0) {
    items.push({
      key: "sources",
      label: sourcesLabel || "Sources",
      onClick: onSources,
      icon: <IconSources />,
    });
  }
  return (
    <aside className="hm-chat-rail" aria-label={railAriaLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`hm-chat-rail__btn${item.key === "sources" ? " hm-chat-rail__btn--sources" : ""}`}
          aria-label={item.label}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.icon}
          {item.key === "sources" && (sourcesCount || 0) > 0 ? (
            <span className="hm-chat-rail__badge">{sourcesCount}</span>
          ) : null}
          <span className="hm-chat-rail__tip">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
