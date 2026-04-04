export function getPresetIconForegroundColor(color?: string | null): string {
  if (typeof color === "string" && color.trim()) {
    return color;
  }

  return "var(--primary)";
}

export function getPresetIconSurfaceColor(color?: string | null): string {
  if (typeof color === "string" && color.startsWith("#")) {
    return `${color}12`;
  }

  return "color-mix(in srgb, var(--primary) 7%, transparent)";
}
