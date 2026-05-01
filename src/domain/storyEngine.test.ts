import { describe, expect, it } from "vitest";

import { checkChildInputSafety } from "./safety";
import { buildAgeReply, buildStory } from "./storyEngine";
import { defaultParentConfig } from "./types";

describe("story engine", () => {
  it("uses parent age as the safety reference when child gives impossible age", () => {
    const reply = buildAgeReply("j'ai 42 ans", 6);

    expect(reply).toContain("mini-grand sage");
    expect(reply).toContain("histoire parfaite pour toi");
  });

  it("blocks parent-forbidden topics with a soft redirect", () => {
    const result = checkChildInputSafety("je veux un monstre realiste", {
      ...defaultParentConfig,
      blockedTopics: ["monstre realiste"],
    });

    expect(result.safe).toBe(false);
    expect(result.childFriendlyReply).toContain("mystere rigolo");
  });

  it("builds a child-safe story from configured themes and answers", () => {
    const story = buildStory(defaultParentConfig, {
      mood: "joyeux",
      genre: "magique",
      hero: "Lina",
    });

    expect(story).toContain("Lina");
    expect(story).toContain("s'il te plait");
    expect(story).toContain("Amitie");
  });
});
