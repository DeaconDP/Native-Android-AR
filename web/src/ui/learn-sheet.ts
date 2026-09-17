import {
  getLearnTopic,
  LEARN_SECTIONS,
  MODE_LABELS,
  STATUS_LABELS,
  topicsForSection,
  type LearnStatus,
  type LearnTopic,
} from "../learn/curriculum";
import type { ArMode } from "../native/arBridge";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function modeChip(arMode: ArMode | null | undefined): string {
  if (!arMode) return "";
  const label = MODE_LABELS[arMode] ?? arMode;
  return `<p class="learn__mode">Your mode right now: <span>${escapeHtml(label)}</span></p>`;
}

function statusChip(status: LearnStatus): string {
  const label = STATUS_LABELS[status];
  return `<span class="learn__status learn__status--${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function renderTopicList(arMode: ArMode | null | undefined): string {
  const groups = LEARN_SECTIONS.map((section) => {
    const topics = topicsForSection(section.id);
    if (topics.length === 0) return "";
    const items = topics
      .map(
        (topic) => `
      <button type="button" class="learn__item" data-action="learn-topic" data-learn-id="${escapeHtml(topic.id)}">
        <span class="learn__item-head">
          <span class="learn__item-title">${escapeHtml(topic.title)}</span>
          ${statusChip(topic.status)}
        </span>
        <span class="learn__item-summary">${escapeHtml(topic.summary)}</span>
      </button>
    `,
      )
      .join("");
    return `
      <section class="learn__group" aria-labelledby="learn-sec-${escapeHtml(section.id)}">
        <h3 class="learn__group-title" id="learn-sec-${escapeHtml(section.id)}">${escapeHtml(section.title)}</h3>
        <p class="learn__group-blurb">${escapeHtml(section.blurb)}</p>
        <div class="learn__list">${items}</div>
      </section>
    `;
  }).join("");

  return `
    <div class="picker-backdrop learn-backdrop" data-action="close-learn">
      <section class="picker learn" role="dialog" aria-label="How AR works" data-learn-panel>
        <header class="picker__header">
          <h2>How it works</h2>
          <button type="button" class="icon-btn" data-action="close-learn" aria-label="Close">✕</button>
        </header>
        ${modeChip(arMode)}
        <p class="learn__intro">Syllabus: this app’s live lab first, then kinds of AR and software stacks. Chips mark Live demo, Explained, or Roadmap.</p>
        ${groups}
      </section>
    </div>
  `;
}

function tryInArButton(topic: LearnTopic, phase: "gate" | "ar"): string {
  if (topic.status !== "live") return "";
  if (phase === "ar") {
    return `<button type="button" class="btn btn--secondary learn__try" data-action="close-learn">Back to AR</button>`;
  }
  return `<button type="button" class="btn btn--secondary learn__try" data-action="try-ar">Try in AR</button>`;
}

function renderArticle(
  topic: LearnTopic,
  arMode: ArMode | null | undefined,
  phase: "gate" | "ar",
): string {
  const sections = topic.sections
    .map(
      (section) => `
        <section class="learn__section">
          <h3>${escapeHtml(section.heading)}</h3>
          ${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        </section>
      `,
    )
    .join("");

  return `
    <div class="picker-backdrop learn-backdrop" data-action="close-learn">
      <section class="picker learn learn--article" role="dialog" aria-label="${escapeHtml(topic.title)}" data-learn-panel>
        <header class="picker__header">
          <button type="button" class="btn btn--ghost" data-action="learn-back">Back</button>
          <button type="button" class="icon-btn" data-action="close-learn" aria-label="Close">✕</button>
        </header>
        ${modeChip(arMode)}
        <p class="learn__article-meta">${statusChip(topic.status)}</p>
        <h2 class="learn__article-title">${escapeHtml(topic.title)}</h2>
        <p class="learn__item-summary">${escapeHtml(topic.summary)}</p>
        <div class="learn__article-body">${sections}</div>
        ${tryInArButton(topic, phase)}
      </section>
    </div>
  `;
}

export function resolveLearnMode(
  arMode: ArMode | null,
  metricsMode: ArMode | null | undefined,
): ArMode | null {
  return arMode ?? metricsMode ?? null;
}

export function renderLearnSheet(
  topicId: string | null,
  arMode: ArMode | null,
  metricsMode: ArMode | null | undefined,
  phase: "gate" | "ar" = "gate",
): string {
  const mode = resolveLearnMode(arMode, metricsMode);
  const topic = getLearnTopic(topicId);
  if (topic) return renderArticle(topic, mode, phase);
  return renderTopicList(mode);
}
