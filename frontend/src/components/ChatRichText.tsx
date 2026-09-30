import { Fragment, type ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)'\]])/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

function linkifyInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...boldify(text.slice(last, match.index), `${keyPrefix}-t${last}`));
    }
    if (match[1] && match[2]) {
      nodes.push(
        <a
          key={`${keyPrefix}-md${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="hm-chat-link"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      const href = match[3];
      nodes.push(
        <a
          key={`${keyPrefix}-url${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hm-chat-link"
        >
          {href.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(...boldify(text.slice(last), `${keyPrefix}-t${last}`));
  }
  return nodes;
}

function boldify(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(BOLD_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`${keyPrefix}-p${last}`}>{text.slice(last, match.index)}</Fragment>,
      );
    }
    nodes.push(
      <strong key={`${keyPrefix}-b${match.index}`}>{match[1]}</strong>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length || nodes.length === 0) {
    nodes.push(<Fragment key={`${keyPrefix}-p${last}`}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}

function isBullet(line: string): boolean {
  return /^\s*[-•*]\s+/.test(line);
}

function isNumbered(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "");
}

/**
 * Lightweight markdown for assistant chat bubbles: bullets, numbered lists,
 * **bold**, [label](url) and bare https links. No HTML from the model is executed.
 */
export function ChatRichText({ text }: { text: string }) {
  const raw = (text || "").replace(/\r\n/g, "\n").trimEnd();
  if (!raw) return null;

  const lines = raw.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isBullet(line) || isNumbered(line)) {
      const ordered = isNumbered(line);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) {
          // blank line ends the list
          break;
        }
        if (ordered ? isNumbered(cur) : isBullet(cur)) {
          items.push(stripBullet(cur));
          i += 1;
          continue;
        }
        // Continuation line under a bullet (indented or plain)
        if (items.length && (/^\s{2,}\S/.test(cur) || (!isBullet(cur) && !isNumbered(cur) && cur.trim()))) {
          // Only treat as continuation if next isn't a new list item and previous was list
          if (!isBullet(cur) && !isNumbered(cur)) {
            items[items.length - 1] = `${items[items.length - 1]}\n${cur.trim()}`;
            i += 1;
            continue;
          }
        }
        break;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={`list-${blockKey++}`} className="hm-chat-list">
          {items.map((item, idx) => (
            <li key={idx}>
              {item.split("\n").map((part, pi) => (
                <Fragment key={pi}>
                  {pi > 0 ? <br /> : null}
                  {linkifyInline(part, `li${blockKey}-${idx}-${pi}`)}
                </Fragment>
              ))}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-list lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isNumbered(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="hm-chat-p">
        {para.map((part, pi) => (
          <Fragment key={pi}>
            {pi > 0 ? <br /> : null}
            {linkifyInline(part, `p${blockKey}-${pi}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="hm-chat-rich">{blocks}</div>;
}
