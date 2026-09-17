import {
  LEARN_SECTIONS,
  LEARN_TOPICS,
  coachForMilestone,
  type CoachMilestone,
  type LearnSectionId,
  type LearnStatus,
} from "../src/learn/curriculum.ts";

const STATUSES: LearnStatus[] = ["live", "explained", "roadmap"];
const MODES = ["native", "webxr", "orbit"] as const;
const MILESTONES: CoachMilestone[] = [
  "scan",
  "ready",
  "placed",
  "gesture",
  "orbit",
];
const LIVE_REQUIRED_SECTIONS: LearnSectionId[] = [
  "this-app",
  "placement",
  "platforms",
];
const TOPIC_REQUIRED_SECTIONS: LearnSectionId[] = ["kinds", "stacks"];

function fail(message: string): never {
  console.error(`verify-curriculum: ${message}`);
  process.exit(1);
}

const sectionIds = new Set(LEARN_SECTIONS.map((s) => s.id));
const topicIds = new Set(LEARN_TOPICS.map((t) => t.id));

if (sectionIds.size !== LEARN_SECTIONS.length) {
  fail("LEARN_SECTIONS has duplicate ids");
}

const expectedSections: LearnSectionId[] = [
  "this-app",
  "placement",
  "platforms",
  "kinds",
  "stacks",
];
for (const id of expectedSections) {
  if (!sectionIds.has(id)) {
    fail(`LEARN_SECTIONS missing id "${id}"`);
  }
}

for (const topic of LEARN_TOPICS) {
  if (!sectionIds.has(topic.section)) {
    fail(`topic "${topic.id}" has unknown section "${topic.section}"`);
  }
  if (!topic.title?.trim()) {
    fail(`topic "${topic.id}" has empty title`);
  }
  if (!topic.summary?.trim()) {
    fail(`topic "${topic.id}" has empty summary`);
  }
  if (!STATUSES.includes(topic.status)) {
    fail(`topic "${topic.id}" has invalid status "${String(topic.status)}"`);
  }
  if (!Array.isArray(topic.sections) || topic.sections.length < 1) {
    fail(`topic "${topic.id}" needs ≥1 content section`);
  }
  for (const [i, section] of topic.sections.entries()) {
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length < 1) {
      fail(`topic "${topic.id}" section[${i}] needs ≥1 paragraph`);
    }
    for (const [j, para] of section.paragraphs.entries()) {
      if (!para?.trim()) {
        fail(`topic "${topic.id}" section[${i}] paragraph[${j}] is empty`);
      }
    }
  }
}

for (const mode of MODES) {
  for (const milestone of MILESTONES) {
    const { topicId } = coachForMilestone(mode, milestone);
    if (!topicIds.has(topicId)) {
      fail(
        `coachForMilestone(${mode}, ${milestone}) → topicId "${topicId}" not in LEARN_TOPICS`,
      );
    }
  }
}

for (const milestone of MILESTONES) {
  if (milestone === "orbit") continue;
  const { topicId } = coachForMilestone("native", milestone, "face");
  if (topicId !== "kind-face") {
    fail(
      `coachForMilestone(native, ${milestone}, face) → "${topicId}" expected kind-face`,
    );
  }
}

for (const status of STATUSES) {
  if (!LEARN_TOPICS.some((t) => t.status === status)) {
    fail(`no topic with status "${status}"`);
  }
}

for (const section of LIVE_REQUIRED_SECTIONS) {
  if (!LEARN_TOPICS.some((t) => t.section === section && t.status === "live")) {
    fail(`section "${section}" needs ≥1 live topic`);
  }
}

for (const section of TOPIC_REQUIRED_SECTIONS) {
  if (!LEARN_TOPICS.some((t) => t.section === section)) {
    fail(`section "${section}" needs ≥1 topic`);
  }
}

console.log(`verify-curriculum: ok (${LEARN_TOPICS.length} topics)`);
