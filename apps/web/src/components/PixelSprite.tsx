"use client";

type Palette = Record<string, string>;

interface Props {
  pixels: string[];
  palette: Palette;
  scale?: number;
}

export default function PixelSprite({ pixels, palette, scale = 3 }: Props) {
  const h = pixels.length;
  const w = Math.max(...pixels.map((r) => r.length));
  const rects: React.ReactNode[] = [];
  pixels.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      const fill = palette[ch];
      if (!fill) return;
      rects.push(
        <rect key={`${x}-${y}`} x={x * scale} y={y * scale} width={scale} height={scale} fill={fill} />
      );
    });
  });
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w * scale} ${h * scale}`}
      style={{ imageRendering: "pixelated", display: "block" }}>
      {rects}
    </svg>
  );
}

// ── Stardew Valley-style sprites (10 wide × 18 tall) ─────────────────────

export const SPRITES = {
  // Luna — purple witch/wizard with star wand
  luna: {
    palette: {
      H: "#4c1d95", // hat dark
      h: "#7c3aed", // hat mid
      S: "#fde68a", // star yellow
      F: "#fcd9b2", // warm face
      E: "#2d1b69", // eyes
      R: "#6d28d9", // robe
      r: "#5b21b6", // robe shadow
      B: "#fde68a", // belt/wand
      L: "#3b0764", // boots
      W: "#c4b5fd", // wand glow
    },
    pixels: [
      "__SSHS___",
      "_HHHhHH__",
      "_HHhHHH__",
      "__FFFFF__",
      "_FFEFEF__",
      "__FFFFF__",
      "__RRRRR__",
      "_RRRRRR__",
      "_RrBBrR__",
      "_RRRRRR__",
      "_RRRRRR__",
      "WRR__RR__",
      "_LL__LL__",
      "_LL__LL__",
    ],
  },

  // Caster — teal tech wizard with antenna headset
  caster: {
    palette: {
      A: "#67e8f9", // antenna
      a: "#0891b2", // antenna base
      T: "#0e7490", // teal body
      t: "#155e75", // teal shadow
      F: "#a5f3fc", // light face
      E: "#083344", // eyes
      G: "#22d3ee", // glow detail
      L: "#164e63", // boots
    },
    pixels: [
      "___AA____",
      "__aAAa___",
      "_TTTTTTT_",
      "_TFFFFF__",
      "_TFEEFT__",
      "_TFFFFF__",
      "_TTTTTTT_",
      "GTTTTTTG_",
      "_TTTTTT__",
      "_TTTTTT__",
      "_TtttttT_",
      "_TT__TT__",
      "_LL__LL__",
      "_LL__LL__",
    ],
  },

  // Dev — green hacker with glasses and hoodie
  dev: {
    palette: {
      G: "#15803d", // green hoodie
      g: "#166534", // hoodie shadow
      F: "#dcfce7", // face
      S: "var(--hb-success)", // glasses (lime)
      s: "#86efac", // glasses lens
      E: "#052e16", // eyes
      P: "#14532d", // pocket detail
      L: "#065f46", // boots
    },
    pixels: [
      "_GGGGG___",
      "GGFFFFF__",
      "GGFFfFF__",
      "GSSSSSG__",
      "GSsEEsG__",
      "GSSSSSG__",
      "_GGGGG___",
      "GGGGGGG__",
      "GPGGGgG__",
      "GGGGGGG__",
      "GGGGGGG__",
      "_GG__GG__",
      "_LL__LL__",
      "_LL__LL__",
    ],
  },

  // Meta — pink photographer with bun and camera
  meta: {
    palette: {
      R: "#9d174d", // hair
      r: "#be185d", // hair highlight
      F: "#fce7f3", // face
      X: "#fda4af", // blush
      E: "#4c0519", // eyes
      P: "#831843", // body
      p: "#9d174d", // body shadow
      C: "#f472b6", // camera/detail
      L: "#500724", // boots
    },
    pixels: [
      "_RRrrRR__",
      "RRRrRRRR_",
      "_FFFFFF__",
      "_FXFFXF__",
      "_FEFFE___",
      "_FFFFFF__",
      "__PPPP___",
      "_PPPPPP__",
      "_PCPpCP__",
      "_PPPPPP__",
      "_PPPPPP__",
      "_PP__PP__",
      "_LL__LL__",
      "_LL__LL__",
    ],
  },
} satisfies Record<string, { palette: Palette; pixels: string[] }>;
