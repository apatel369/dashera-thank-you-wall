export const NOTE_PAPER_BG: Record<string, string> = {
  golden:      "#fef08a",
  rose:        "#ffe4e6",
  deepBlue:    "#dbeafe",
  forestGreen: "#dcfce7",
};

export const NOTE_FONT_COLORS: Record<string, string> = {
  warm:    "#5c2a0a",
  crimson: "#9b1b1b",
  indigo:  "#312075",
  forest:  "#1a4731",
  ink:     "#1a1a2e",
};

export const NOTE_SYMBOL_EMOJI: Record<string, string> = {
  none: "", namaste: "🙏", heart: "❤️", hug: "🤗",
  lotus: "🪷", om: "ॐ", star: "⭐",
};

export function noteRotation(id: number): number {
  return ((id % 11) - 5) * 0.6;
}

export function buildNoteStyle(
  bgColor: string,
  textureId = "plain",
  rotate = -1.5,
): React.CSSProperties {
  const layers: string[] = [];
  const sizes: string[]  = [];

  if (textureId === "ruled") {
    layers.push("repeating-linear-gradient(transparent,transparent 26px,rgba(0,0,0,0.10) 26px,rgba(0,0,0,0.10) 28px)");
    sizes.push("auto auto");
  } else if (textureId === "dotted") {
    layers.push("radial-gradient(circle,rgba(0,0,0,0.18) 1.2px,transparent 1.2px)");
    sizes.push("18px 18px");
  }

  return {
    backgroundColor: bgColor,
    transform: `rotate(${rotate}deg)`,
    ...(layers.length > 0 ? { backgroundImage: layers.join(", "), backgroundSize: sizes.join(", ") } : {}),
  };
}
