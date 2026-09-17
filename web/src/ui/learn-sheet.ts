import {
  getLearnTopic,
  LEARN_TOPICS,
  MODE_LABELS,
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

function renderTopicList(arMode: ArMode | null | undefined): string {
  const items = LEARN_TOPICS.map(
    (topic) => `
      <button type="button" class="learn__item" data-action="learn-topic" data-learn-id="${escapeHtml(topic.id)}">
        <span class="learn__item-title">${escapeHtml(topic.title)}</span>
        <span class="learn__item-summary">${escapeHtml(topic.summary)}</span>
      </button>
    `,
  ).join("");

  return `
    <div class="picker-backdrop learn-backdrop" data-action="close-learn">
      <section class="picker learn" role="dialog" aria-label="How AR works" data-learn-panel>
        <header class="picker__header">
          <h2>How it works</h2>
          <button type="button" class="icon-btn" data-action="close-learn" aria-label="Close">✕</button>
        </header>
        ${modeChip(arMode)}
        <p class="learn__intro">Short lessons on the real techniques this app uses — native SceneView/ARCore &amp; ARKit first, then WebXR and other fallbacks.</p>
        <div class="learn__list">${items}</div>
      </section>
    </div>
  `;
}

function renderArticle(
  topic: LearnTopic,
  arMode: ArMode | null | undefined,
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
        <h2 class="learn__article-title">${escapeHtml(topic.title)}</h2>
        <p class="learn__item-summary">${escapeHtml(topic.summary)}</p>
        <div class="learn__article-body">${sections}</div>
      </section>
    </div>
  `;
}

/** Active mode for the chip: live session or gate probe on metrics. */
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
): string {
  const mode = resolveLearnMode(arMode, metricsMode);
  const topic = getLearnTopic(topicId);
  if (topic) return renderArticle(topic, mode);
  return renderTopicList(mode);
}
