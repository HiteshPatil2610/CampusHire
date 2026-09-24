import { Fragment, type ReactNode } from "react";

/**
 * An announcement's content, rendered as text that a person wrote — not as
 * markup a browser executes. There is no `dangerouslySetInnerHTML` anywhere
 * here: every node below is a React element this module builds itself, so
 * there is nothing an author could type that becomes a script or a tag.
 *
 * The syntax an author can use is deliberately small: **bold**, "- " or "* "
 * bullet lines, and [text](url) links — the three things Item 19 asks for,
 * not a general markup language. A link's URL must start with http:// or
 * https://; anything else (a `javascript:` URI, for instance) renders as the
 * literal text instead of becoming a link.
 */

const LINK_URL_PATTERN = /^https?:\/\//i;

/** Bold and links within one line; everything else is plain text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // **bold** or [text](url), whichever comes first.
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${index++}`}>{match[1]}</strong>);
    } else {
      const [, , linkText, url] = match;
      if (LINK_URL_PATTERN.test(url)) {
        nodes.push(
          <a key={`${keyPrefix}-${index++}`} href={url} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        );
      } else {
        // Not a safe scheme — shown as the author typed it, not linked.
        nodes.push(match[0]);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isBulletLine(line: string): boolean {
  return /^[-*]\s+/.test(line);
}

/** The announcement's content as safe React nodes: paragraphs and bullet lists. */
export function renderAnnouncementContent(content: string): ReactNode {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let blockIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join("\n");
    blocks.push(
      <p key={`p-${blockIndex++}`} style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
        {renderInline(text, `p-${blockIndex}`)}
      </p>
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blockIndex++}`} style={{ margin: "0 0 10px", paddingLeft: 20 }}>
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blockIndex}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const line of lines) {
    if (isBulletLine(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();

  return <Fragment>{blocks}</Fragment>;
}

/**
 * Plain-text preview of the content, with the rich-text syntax stripped
 * rather than shown literally — a card excerpt is not the place for raw
 * `**`/`[]()` characters.
 */
export function announcementExcerpt(content: string, maxLength = 220): string {
  const plain = content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > maxLength ? `${plain.slice(0, maxLength - 3)}...` : plain;
}
