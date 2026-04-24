export const radii = {
  none: 0,
  hairline: 2,
  card: 6,
  input: 2,
  button: 4,
  pill: 999,
  image: 2,
} as const;

export type Radii = typeof radii;
