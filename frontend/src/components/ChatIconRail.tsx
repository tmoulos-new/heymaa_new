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
}: {
  railAriaLabel: string;
  newChatLabel: string;
  searchLabel: string;
  libraryLabel: string;
  onNewChat: () => void;
  onSearch: () => void;
  onLibrary: () => void;
  newChatDisabled?: boolean;
}) {
  const items: RailItem[] = [
    { key: "new", label: newChatLabel, onClick: onNewChat, disabled: newChatDisabled, icon: <IconCirclePlus /> },
    { key: "search", label: searchLabel, onClick: onSearch, icon: <IconSearch /> },
    { key: "library", label: libraryLabel, onClick: onLibrary, icon: <IconImages /> },
  ];
  return (
    <aside className="hm-chat-rail" aria-label={railAriaLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="hm-chat-rail__btn"
          aria-label={item.label}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.icon}
          <span className="hm-chat-rail__tip">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
