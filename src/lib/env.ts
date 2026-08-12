// Just the shape the provider factories read: a bag of optional strings.
// `NodeJS.ProcessEnv` would work at runtime but requires `NODE_ENV`, so tests
// couldn't pass a two-key object without inventing fields the code never reads.
export type EnvSource = Record<string, string | undefined>;
