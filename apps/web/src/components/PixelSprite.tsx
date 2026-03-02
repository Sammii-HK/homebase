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
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w * scale} ${h * scale}`}
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {rects}
    </svg>
  );
}

// ── Sprite definitions ──────────────────────────────────────────────────────

export const SPRITES = {
  luna: {
    palette: {
      Y: "#fde68a", // crown stars
      P: "#7c3aed", // purple body/hat
      L: "#ddd6fe", // lavender face
      E: "#1e1b4b", // eyes
    },
    pixels: [
      "__YY_YY_",
      "_PPPPPP_",
      "PPLLLLPP",
      "PLEELLPP",
      "PPLLLLPP",
      "_PPPPPP_",
      "PPPPPPPP",
      "PPPPPPPP",
      "_PP__PP_",
      "_PP__PP_",
    ],
  },
  caster: {
    palette: {
      C: "#67e8f9", // antenna cyan
      T: "#0e7490", // teal body
      L: "#cffafe", // light face
      E: "#083344", // eyes
    },
    pixels: [
      "____C___",
      "___CCC__",
      "_TTTTTT_",
      "TTLLLTT_",
      "TLELLTTT",
      "TTLLLTT_",
      "_TTTTTT_",
      "TTTTTTTT",
      "TTTTTTTT",
      "_TT__TT_",
    ],
  },
  dev: {
    palette: {
      G: "#166534", // dark green body/hair
      F: "#dcfce7", // light face
      S: "#84cc16", // glasses (lime)
      E: "#052e16", // eyes
    },
    pixels: [
      "_GGGGGG_",
      "_FFFFFF_",
      "_FFFFFF_",
      "FSSSSSSF",
      "FSEESSSF",
      "FSSSSSSF",
      "_GGGGGG_",
      "GGGGGGGG",
      "GGGGGGGG",
      "_GG__GG_",
    ],
  },
  meta: {
    palette: {
      R: "#be185d", // raspberry hair
      F: "#fce7f3", // light pink face
      X: "#fda4af", // blush
      E: "#4c0519", // eyes
      P: "#9d174d", // body
    },
    pixels: [
      "_RRRRRR_",
      "RRRRRRRR",
      "_FFFFFF_",
      "FFXFFXFF",
      "FFEFFEFF",
      "_FFFFFF_",
      "_PPPPPP_",
      "PPPPPPPP",
      "PPPPPPPP",
      "_PP__PP_",
    ],
  },
} satisfies Record<string, { palette: Palette; pixels: string[] }>;
