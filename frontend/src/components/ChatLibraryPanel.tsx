import type { ChatAttachment } from "../lib/chatAttachments";

export type ChatLibraryItem = {
  key: string;
  kind: "image" | "video" | "file";
  name: string;
  href?: string;
  date: string;
  source: "live" | string;
  msgIndex: number;
  attIndex: number;
};

type LibraryMessage = {
  attachments?: ChatAttachment[];
};

export function collectChatLibraryItems<T extends LibraryMessage>(
  liveMessages: T[],
  threads: { id: string; date: string; messages: T[] }[],
  liveDateLabel: string,
): { documents: ChatLibraryItem[]; media: ChatLibraryItem[] } {
  const documents: ChatLibraryItem[] = [];
  const media: ChatLibraryItem[] = [];
  const add = (msgs: T[], source: "live" | string, date: string) => {
    msgs.forEach((m, i) => {
      m.attachments?.forEach((att, j) => {
        const item: ChatLibraryItem = {
          key: `${source}-${i}-${j}`,
          kind: att.kind,
          name: att.name,
          date,
          source,
          msgIndex: i,
          attIndex: j,
        };
        if (att.kind === "image" && att.data) {
          item.href = att.data;
          media.push(item);
          return;
        }
        if (att.kind === "video" && att.data) {
          item.href = att.data;
          media.push(item);
          return;
        }
        if (att.kind === "file") {
          if (att.data) {
            item.href = att.data.includes(",")
              ? att.data
              : `data:${att.mime || "application/octet-stream"};base64,${att.data}`;
          } else if (att.textPreview) {
            item.href = `data:text/plain;charset=utf-8,${encodeURIComponent(att.textPreview)}`;
          }
          documents.push(item);
        }
      });
    });
  };
  add(liveMessages, "live", liveDateLabel);
  threads.forEach((th) => add(th.messages, th.id, th.date));
  return { documents, media };
}

export function removeMessageAttachment<T extends LibraryMessage>(
  msgs: T[],
  msgIndex: number,
  attIndex: number,
): T[] {
  return msgs.flatMap((m, i) => {
    if (i !== msgIndex) return [m];
    const atts = (m.attachments || []).filter((_, j) => j !== attIndex);
    const next = { ...m, attachments: atts.length ? atts : undefined };
    const leftover = next as T & { content?: string; promo?: unknown; memorySuggestion?: unknown };
    if (
      !String(leftover.content || "").trim() &&
      !next.attachments?.length &&
      !leftover.promo &&
      !leftover.memorySuggestion
    ) {
      return [];
    }
    return [next];
  });
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M10 11v6M14 11v6M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-4-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ChatLibraryPanel({
  documents,
  media,
  preview,
  docsTitle,
  mediaTitle,
  docsEmpty,
  mediaEmpty,
  deleteLabel,
  onPreview,
  onClosePreview,
  onRequestDelete,
}: {
  documents: ChatLibraryItem[];
  media: ChatLibraryItem[];
  preview: { src: string; name: string; kind?: "image" | "video" } | null;
  docsTitle: string;
  mediaTitle: string;
  docsEmpty: string;
  mediaEmpty: string;
  deleteLabel: string;
  onPreview: (item: ChatLibraryItem) => void;
  onClosePreview: () => void;
  onRequestDelete: (item: ChatLibraryItem) => void;
}) {
  if (preview) {
    return (
      <div className="hm-chat-library-preview-wrap">
        {preview.kind === "video" ? (
          <video className="hm-chat-library-preview" src={preview.src} controls playsInline />
        ) : (
          <button type="button" className="hm-chat-library-preview-wrap" onClick={onClosePreview}>
            <img className="hm-chat-library-preview" src={preview.src} alt={preview.name} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="hm-chat-library">
      <section className="hm-chat-library-section">
        <h3 className="hm-chat-library-section__title">{docsTitle}</h3>
        {documents.length === 0 ? (
          <div className="hm-empty-state">{docsEmpty}</div>
        ) : (
          <div className="hm-chat-library-docs">
            {documents.map((doc) => (
              <div key={doc.key} className="hm-chat-library-doc">
                <button
                  type="button"
                  className="hm-chat-library-doc__main"
                  onClick={() => {
                    if (doc.href) window.open(doc.href, "_blank", "noopener,noreferrer");
                  }}
                >
                  <span className="hm-chat-library-doc__icon">
                    <FileIcon />
                  </span>
                  <span className="hm-chat-library-doc__text">
                    <span className="hm-chat-library-doc__name">{doc.name}</span>
                    {doc.date ? <span className="hm-chat-library-doc__meta">{doc.date}</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="hm-chat-library-doc__trash"
                  aria-label={deleteLabel}
                  onClick={() => onRequestDelete(doc)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hm-chat-library-section">
        <h3 className="hm-chat-library-section__title">{mediaTitle}</h3>
        {media.length === 0 ? (
          <div className="hm-empty-state">{mediaEmpty}</div>
        ) : (
          <div className="hm-chat-library-grid">
            {media.map((item) => (
              <div key={item.key} className="hm-chat-library-cell">
                <button
                  type="button"
                  className="hm-chat-library-cell__open"
                  onClick={() => onPreview(item)}
                >
                  {item.kind === "video" && item.href ? (
                    <video src={item.href} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.href} alt={item.name} />
                  )}
                </button>
                <button
                  type="button"
                  className="hm-chat-library-cell__trash"
                  aria-label={deleteLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete(item);
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
