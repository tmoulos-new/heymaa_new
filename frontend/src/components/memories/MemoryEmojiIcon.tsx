const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PALETTE: Record<string, { color: string; bg: string }> = {
  "⭐": { color: "#c4a574", bg: "#f6efe4" },
  "🦷": { color: "#7eaea3", bg: "#e8f2ef" },
  "😊": { color: "#d4a08c", bg: "#f6ebe4" },
  "👶": { color: "#a89bb8", bg: "#efeaf4" },
  "🚼": { color: "#a89bb8", bg: "#efeaf4" },
  "🚶": { color: "#7a88a8", bg: "#eaedf3" },
  "🎉": { color: "#d4a07a", bg: "#f6eee4" },
  "📷": { color: "#8a92a8", bg: "#eceef2" },
  "❤️": { color: "#c48b94", bg: "#f4e8ea" },
  "🍼": { color: "#7eb0a6", bg: "#e8f1ee" },
  "🛁": { color: "#8aa8c4", bg: "#e8eef4" },
  "😴": { color: "#9b93b0", bg: "#eeebf3" },
  "🚩": { color: "#7a88a8", bg: "#eaedf3" },
  "🏆": { color: "#7a88a8", bg: "#eaedf3" },
  "🧸": { color: "#b8a090", bg: "#f3ece6" },
  "✨": { color: "#c4a574", bg: "#f6efe4" },
  "💛": { color: "#c4a574", bg: "#f6efe4" },
  "📝": { color: "#8a92a8", bg: "#eceef2" },
  "🎬": { color: "#8a92a8", bg: "#eceef2" },
  "🥣": { color: "#c4a574", bg: "#f6efe4" },
  "🔔": { color: "#c48b94", bg: "#f4e8ea" },
  "💬": { color: "#9b93b0", bg: "#eeebf3" },
  "🧱": { color: "#b8a090", bg: "#f3ece6" },
  "🪜": { color: "#7a88a8", bg: "#eaedf3" },
  "🌊": { color: "#8aa8c4", bg: "#e8eef4" },
};

function normalizeEmoji(emoji?: string) {
  if (!emoji) return "⭐";
  if (emoji === "🏆") return "🚩";
  return emoji;
}

export function memoryEmojiTone(emoji?: string) {
  const key = normalizeEmoji(emoji);
  return PALETTE[key] || PALETTE["⭐"];
}

function Glyph({ emoji }: { emoji: string }) {
  switch (emoji) {
    case "🦷":
      return (
        <>
          <path d="M8.2 7.1c0-1.5 1.3-2.6 2.9-2.6h1.8c1.6 0 2.9 1.1 2.9 2.6v4.3c0 1.5-.5 3.5-1.3 5-.6 1.1-1.5 2-2.5 2s-1.9-.9-2.5-2c-.8-1.5-1.3-3.5-1.3-5V7.1z" {...stroke} />
          <path d="M10.2 9.4h3.6" {...stroke} />
        </>
      );
    case "😊":
      return (
        <>
          <circle cx="12" cy="12" r="7.4" {...stroke} />
          <circle cx="9.3" cy="10.4" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="14.7" cy="10.4" r="0.85" fill="currentColor" stroke="none" />
          <path d="M9.1 14.1c.9 1.15 2 1.7 2.9 1.7s2-.55 2.9-1.7" {...stroke} />
        </>
      );
    case "🥣":
      return (
        <>
          <path d="M5.2 13.2c.4 3.6 3.2 5.8 6.8 5.8s6.4-2.2 6.8-5.8H5.2z" {...stroke} />
          <path d="M5.2 13.2h13.6" {...stroke} />
          <path d="M14.2 5.4c1.1.15 1.9 1.05 1.85 2.15-.08 1.2-1.15 1.85-2.35 1.7" {...stroke} />
          <path d="M13.7 9.2 11.6 12.4" {...stroke} />
        </>
      );
    case "🔔":
      return (
        <>
          <ellipse cx="12" cy="8.4" rx="4.6" ry="4.2" {...stroke} />
          <circle cx="10.4" cy="7.6" r="0.55" fill="currentColor" stroke="none" />
          <circle cx="13.6" cy="7.6" r="0.55" fill="currentColor" stroke="none" />
          <circle cx="12" cy="9.6" r="0.55" fill="currentColor" stroke="none" />
          <path d="M10.6 12.2 9.4 19.4h5.2L13.4 12.2" {...stroke} />
          <path d="M10.8 15.6h2.4" {...stroke} />
        </>
      );
    case "🚼":
      return (
        <>
          <circle cx="7.6" cy="10.2" r="2.35" {...stroke} />
          <path d="M9.8 11.4c1.5.2 3.5.15 5.2-.7 1.4-.7 2.5-1.1 3.4-.4" {...stroke} />
          <path d="M12.2 11.6c.15 1.5.5 3.1 1.5 4.4" {...stroke} />
          <path d="M8.6 12.8 6.5 16.2M10.2 13.4 8.4 17.2" {...stroke} />
          <path d="M14.8 12.4 16.6 16.6M16.4 11.6 18.6 15.2" {...stroke} />
        </>
      );
    case "👶":
      return (
        <>
          <circle cx="12" cy="11.6" r="6.1" {...stroke} />
          <path d="M9.3 8.3c.55-1.35 1.5-2.1 2.7-2.1s2.15.75 2.7 2.1" {...stroke} />
          <circle cx="9.9" cy="11.3" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="14.1" cy="11.3" r="0.7" fill="currentColor" stroke="none" />
          <path d="M10.5 14.1c.85.7 2.15.7 3 0" {...stroke} />
        </>
      );
    case "🚶":
      return (
        <>
          <circle cx="12.4" cy="5.6" r="2.35" {...stroke} />
          <path d="M12.4 8.1v3.4" {...stroke} />
          <path d="M12.4 9.6 9.2 11.8M12.4 9.6l3.4 1.5" {...stroke} />
          <path d="M12.4 11.5 9.6 16.8M12.4 11.5l2.2 2.6 1.6 4.2" {...stroke} />
          <path d="M9.6 16.8 8.4 20.2" {...stroke} />
        </>
      );
    case "💬":
      return (
        <>
          <circle cx="10.2" cy="12.2" r="6.2" {...stroke} />
          <circle cx="8" cy="11" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="12.4" cy="11" r="0.7" fill="currentColor" stroke="none" />
          <path d="M8.6 14.4c.7.55 1.55.8 2.4.8" {...stroke} />
          <path d="M16.2 8.4c1.5.35 2.6 1.45 2.7 2.9.1 1.35-.7 2.5-1.9 3.1" {...stroke} />
          <path d="M16.6 10.1h2.2M16.2 12h1.6" {...stroke} />
        </>
      );
    case "🎉":
      return (
        <>
          <path d="M12 4.6 7.8 15.2h8.4L12 4.6z" {...stroke} />
          <path d="M12 4.6V3.2" {...stroke} />
          <circle cx="12" cy="2.6" r="0.75" fill="currentColor" stroke="none" />
          <text
            x="12"
            y="12.6"
            textAnchor="middle"
            fill="currentColor"
            fontSize="6.2"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            1
          </text>
          <path d="M4.8 7.4l1.4 1M4.2 11.4h1.8M5.4 16.2l1.2 1.2M19.2 7.2l-1.3 1.1M19.8 11.6h-1.8M18.6 16.4l-1.2 1.2" {...stroke} />
          <circle cx="5.1" cy="13.6" r="0.55" fill="currentColor" stroke="none" />
          <circle cx="18.9" cy="13.8" r="0.55" fill="currentColor" stroke="none" />
        </>
      );
    case "🧱":
      return (
        <>
          <rect x="8.2" y="4.6" width="7.6" height="4.4" rx="0.8" {...stroke} />
          <rect x="5.2" y="9.6" width="7.2" height="4.4" rx="0.8" {...stroke} />
          <rect x="11.6" y="9.6" width="7.2" height="4.4" rx="0.8" {...stroke} />
          <rect x="3.8" y="14.6" width="7.2" height="4.4" rx="0.8" {...stroke} />
          <rect x="10.4" y="14.6" width="7.2" height="4.4" rx="0.8" {...stroke} />
        </>
      );
    case "🪜":
      return (
        <>
          <path d="M4.4 19.6h5.2V15.4h4.4V11.2h4.4V7h5.2" {...stroke} />
          <path d="M9.6 19.6v-4.2M14 15.4v-4.2M18.4 11.2V7" {...stroke} />
        </>
      );
    case "🌊":
      return (
        <>
          <circle cx="16.4" cy="6.4" r="2.15" {...stroke} />
          <path d="M16.4 3.2v1M16.4 8.6v1M13.3 6.4h-1M20.5 6.4h-1M14.2 4.2l.7.7M18.6 8.6l.7.7M18.6 4.2l-.7.7M14.2 8.6l-.7.7" {...stroke} />
          <path d="M4.2 13.6c1.6 0 1.6 1.8 3.2 1.8s1.6-1.8 3.2-1.8 1.6 1.8 3.2 1.8 1.6-1.8 3.2-1.8 1.6 1.8 3.2 1.8" {...stroke} />
          <path d="M4.2 18.2c1.6 0 1.6 1.8 3.2 1.8s1.6-1.8 3.2-1.8 1.6 1.8 3.2 1.8 1.6-1.8 3.2-1.8 1.6 1.8 3.2 1.8" {...stroke} />
        </>
      );
    case "📷":
      return (
        <>
          <rect x="4" y="8.2" width="16" height="10.6" rx="2" {...stroke} />
          <circle cx="12" cy="13.5" r="2.9" {...stroke} />
          <path d="M9.1 8.2l1.1-2.1h3.6l1.1 2.1" {...stroke} />
        </>
      );
    case "❤️":
    case "💛":
      return (
        <path
          d="M12 19.2c-.4 0-6.8-4.1-8.2-8.1C2.6 8.1 4.2 5.5 7 5.5c1.6 0 2.8.8 3.5 1.9.7-1.1 1.9-1.9 3.5-1.9 2.8 0 4.4 2.6 3.2 5.6-1.4 4-7.8 8.1-8.2 8.1Z"
          {...stroke}
        />
      );
    case "🍼":
      return (
        <>
          <path d="M10 5h4M9.4 7.1h5.2" {...stroke} />
          <path d="M10 9.3c-1.4.55-2.4 2-2.4 3.6V17a3.4 3.4 0 0 0 3.4 3.4h2A3.4 3.4 0 0 0 16.4 17v-4.1c0-1.6-1-3.05-2.4-3.6" {...stroke} />
          <path d="M8.4 13.3h7.2" {...stroke} />
        </>
      );
    case "🛁":
      return (
        <>
          <path d="M5 14.6h14a3 3 0 0 1-3 3.1H8A3 3 0 0 1 5 14.6z" {...stroke} />
          <path d="M7.1 14.6V11a3 3 0 0 1 3-3h1.2" {...stroke} />
          <path d="M7.6 20v-2.3M16.4 20v-2.3" {...stroke} />
        </>
      );
    case "😴":
      return <path d="M15.6 16.6A6.6 6.6 0 1 1 10.8 6.1 5.2 5.2 0 0 0 15.6 16.6z" {...stroke} />;
    case "🚩":
      return (
        <>
          <path d="M7 20.5V5.5" {...stroke} />
          <path d="M7 5.5h8.2l-1.6 3.1 1.6 3.1H7" {...stroke} />
        </>
      );
    case "🧸":
      return (
        <>
          <circle cx="7.8" cy="8" r="2.05" {...stroke} />
          <circle cx="16.2" cy="8" r="2.05" {...stroke} />
          <circle cx="12" cy="13.1" r="5.3" {...stroke} />
          <circle cx="10" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
          <path d="M11 14.7h2" {...stroke} />
        </>
      );
    case "✨":
      return <path d="M12 4.2l1.05 4.05L17.2 9.3l-3.15 2.55.9 4.2L12 14.1l-2.95 1.95.9-4.2L6.8 9.3l4.15-1.05L12 4.2z" {...stroke} />;
    case "📝":
      return (
        <>
          <path d="M7 5.5h7.2L17.5 9v9.5H7a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 7 5.5z" {...stroke} />
          <path d="M14 5.6V9h3.4M9 12.2h6M9 15.2h4.2" {...stroke} />
        </>
      );
    case "🎬":
      return (
        <>
          <rect x="4.5" y="7.5" width="15" height="11" rx="1.6" {...stroke} />
          <path d="M4.5 11h15M7.2 7.5l1.6 3.5M11.2 7.5l1.6 3.5M15.2 7.5l1.6 3.5" {...stroke} />
        </>
      );
    case "⭐":
    default:
      return (
        <path
          d="M12 3.4l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.02 7.06 18.61l.94-5.5-4-3.9 5.53-.8L12 3.4Z"
          {...stroke}
        />
      );
  }
}

export function MemoryEmojiIcon({
  emoji,
  size = 22,
  className,
}: {
  emoji?: string;
  size?: number;
  className?: string;
}) {
  const key = normalizeEmoji(emoji);
  const tone = memoryEmojiTone(key);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{ color: tone.color, display: "block", flexShrink: 0 }}
    >
      <Glyph emoji={key} />
    </svg>
  );
}
