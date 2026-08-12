// Design doc §8's action tiers, as deterministic policy. Core rule 3: the model
// never chooses its own autonomy tier — whether an action may execute is decided
// here, from the action's tier, and the model only learns the verdict.

export type ActionTier = "tier_1" | "tier_2" | "tier_3" | "tier_4";
export type ActionPolicy = "allowed" | "needs_approval" | "forbidden";

export interface ActionPolicyOptions {
  // Design doc §6 / CLAUDE.md: Tier 1 runs unattended only once extraction
  // clears ≥90% precision on `owed_by_me`. No eval harness exists yet, so this
  // defaults off and Tier 1 is held for approval like Tier 2.
  tier1Unattended?: boolean;
}

export function getActionPolicy(
  tier: ActionTier,
  options: ActionPolicyOptions = {},
): ActionPolicy {
  switch (tier) {
    // Private and reversible — drafts, holds, labelling.
    case "tier_1":
      return options.tier1Unattended ? "allowed" : "needs_approval";
    // Outward-facing — one tap, always. Deliberately not togglable.
    case "tier_2":
      return "needs_approval";
    // Money and third parties — prepared, never executed.
    case "tier_3":
      return "forbidden";
    // Code — deferred by explicit decision, design doc §14.
    case "tier_4":
      return "forbidden";
  }
}
