import { describe, expect, it, vi } from "vitest";
import { engineTools, type EngineContext } from "../tools";

const NOW = new Date("2026-08-14T09:00:00Z");

const syncGithub = vi.fn();
vi.mock("@headroom/integrations", () => ({
  syncGithub: (input: unknown) => syncGithub(input),
}));

function context(over: Partial<EngineContext> = {}): EngineContext {
  return {
    userId: "u1",
    now: NOW,
    listCommitments: async () => [],
    ...over,
  };
}

function toolNamed(name: string) {
  const tool = engineTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

describe("check_github handler", () => {
  it("rejects when GitHub is not connected for this user", async () => {
    await expect(toolNamed("check_github").handler({}, context())).rejects.toThrow(/not connected/i);
    expect(syncGithub).not.toHaveBeenCalled();
  });

  it("triggers a fresh sync and returns its summary verbatim", async () => {
    syncGithub.mockResolvedValue({
      created: 1,
      closed: 0,
      openPRsWithoutReviewer: [
        {
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const result = await toolNamed("check_github").handler(
      {},
      context({ githubToken: "gho_test", fetchImpl }),
    );

    expect(syncGithub).toHaveBeenCalledWith({ userId: "u1", token: "gho_test", now: NOW, fetchImpl });
    expect(result).toEqual({
      created: 1,
      closed: 0,
      openPRsWithoutReviewer: [
        {
          number: 31,
          title: "No reviewer requested yet",
          url: "https://github.com/acme/repo/pull/31",
          createdAt: "2026-08-13T00:00:00Z",
        },
      ],
    });
  });
});

describe("check_github registration", () => {
  it("is registered as external, aboutUser, and untiered", () => {
    const tool = toolNamed("check_github");
    expect(tool.external).toBe(true);
    expect(tool.aboutUser).toBe(true);
    expect(tool.tier).toBeUndefined();
  });
});
