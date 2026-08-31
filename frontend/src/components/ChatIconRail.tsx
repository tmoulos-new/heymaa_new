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

function IconSquarePen() {
  return (
    <RailIcon>
      <path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" {...stroke} />
      <path d="M16.5 3.5a1.8 1.8 0 0 1 2.5 2.5L12 13l-3.2.7.7-3.2 6.99-7Z" {...stroke} />
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
    { key: "new", label: newChatLabel, onClick: onNewChat, disabled: newChatDisabled, icon: <IconSquarePen /> },
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
