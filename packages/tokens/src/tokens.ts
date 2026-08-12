// Design tokens as plain data — design doc §11, port rule 4. React Native's
// StyleSheet consumes this file directly, so numeric tokens are numbers (px),
// never "16px" strings. Values are the prototype's palette
// (prototype/headroom.html :root).

export const color = {
  canvas: "#F1F1F4",
  bg: "#FFFFFF",
  surface2: "#FAFAFB",
  ink: "#101219",
  ink2: "#6B6F7E",
  ink3: "#9DA1AE",
  line: "#E9EAEF",
  line2: "#F2F3F6",
  violet: "#5B4FE9",
  violetInk: "#463BC9",
  violetBg: "#F2F0FE",
  violetLine: "#DCD7FC",
  green: "#15825A",
  greenBg: "#E8F5EF",
  amber: "#A96605",
  amberBg: "#FCF2E3",
  red: "#C33B31",
  redBg: "#FCEBE9",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
} as const;

export type ColorToken = keyof typeof color;
export type RadiusToken = keyof typeof radius;
export type SpaceToken = keyof typeof space;
