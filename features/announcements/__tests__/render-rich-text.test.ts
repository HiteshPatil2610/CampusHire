import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderAnnouncementContent, announcementExcerpt } from "../domain/render-rich-text";

/**
 * The announcement rich-text renderer (Phase 8, Item 19): bold, bullet
 * lists and links, built as React elements rather than injected HTML — so
 * the safety property under test is as important as the formatting one.
 */

const html = (content: string) => renderToStaticMarkup(renderAnnouncementContent(content));

describe("renderAnnouncementContent", () => {
  it("renders **bold** text", () => {
    expect(html("This is **important**.")).toContain("<strong>important</strong>");
  });

  it("renders a bullet list from '- ' lines as a real list", () => {
    const out = html("- First\n- Second");
    expect(out).toContain("<ul");
    expect(out).toContain("<li>First</li>");
    expect(out).toContain("<li>Second</li>");
  });

  it("renders '* ' lines as bullets too", () => {
    expect(html("* Only one")).toContain("<li>Only one</li>");
  });

  it("renders a [text](url) link with a safe https URL", () => {
    const out = html("See [the schedule](https://example.com/schedule.pdf).");
    expect(out).toContain('href="https://example.com/schedule.pdf"');
    expect(out).toContain(">the schedule<");
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("accepts http as well as https", () => {
    expect(html("[old site](http://example.com)")).toContain('href="http://example.com"');
  });

  it("never turns a javascript: URL into a link — shown as literal text instead", () => {
    const out = html("[click me](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).toContain("[click me]");
  });

  it("never turns a data: URL into a link", () => {
    const out = html("[open](data:text/html,<script>alert(1)</script>)");
    expect(out).not.toContain("<a ");
  });

  it("never interprets a literal <script> tag typed into the content as markup", () => {
    const out = html("<script>alert(1)</script>");
    // React escapes it as text — it must never appear as a live tag.
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("keeps a plain paragraph with no syntax as plain text", () => {
    expect(html("Nothing special here.")).toContain("Nothing special here.");
  });

  it("separates paragraphs and bullet runs into distinct blocks", () => {
    const out = html("Intro line.\n\n- One\n- Two\n\nClosing line.");
    expect(out).toContain("Intro line.");
    expect(out).toContain("<ul");
    expect(out).toContain("Closing line.");
  });
});

describe("announcementExcerpt", () => {
  it("strips bold markers", () => {
    expect(announcementExcerpt("This is **important** news.")).toBe("This is important news.");
  });

  it("strips link syntax down to the link text", () => {
    expect(announcementExcerpt("See [the schedule](https://example.com).")).toBe(
      "See the schedule."
    );
  });

  it("strips bullet markers", () => {
    expect(announcementExcerpt("- First\n- Second")).toBe("First Second");
  });

  it("truncates long content with an ellipsis", () => {
    const long = "x".repeat(300);
    const excerpt = announcementExcerpt(long, 220);
    expect(excerpt.length).toBe(220);
    expect(excerpt.endsWith("...")).toBe(true);
  });

  it("leaves short content untouched", () => {
    expect(announcementExcerpt("Short and plain.")).toBe("Short and plain.");
  });
});
