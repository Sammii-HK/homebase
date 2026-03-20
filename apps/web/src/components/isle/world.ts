// Isle canvas engine — world layout, furniture, walkability, pathfinding

import type { Dir, Season, TOD, DeskZone, FurniturePiece } from "./types";

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export const TS = 16;
export const OFFICE_COLS = 12;
export const WORLD_COLS = 32;
export const WORLD_ROWS = 17; // 14 land + 3 river
export const RIVER_START_ROW = 14; // rows 14-16 are river
export const WORLD_W = WORLD_COLS * TS; // 512
export const WORLD_H = WORLD_ROWS * TS; // 272

// Door in the right office wall (col 11)
export const DOOR_ROW_START = 5;
export const DOOR_ROW_END = 7;

// ---------------------------------------------------------------------------
// Seeded RNG (FNV-1a)
// ---------------------------------------------------------------------------

export function seededRng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return () => {
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return (h >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Floor values
// ---------------------------------------------------------------------------

const fRng = seededRng("floor-v3");
export const FLOOR_V = new Float32Array(WORLD_COLS * WORLD_ROWS).map(() => fRng());
export function fv(tx: number, ty: number) {
  return FLOOR_V[ty * WORLD_COLS + tx] ?? 0;
}

// ---------------------------------------------------------------------------
// Seasons & time of day
// ---------------------------------------------------------------------------

export function getSeason(): Season {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export function getTOD(): TOD {
  const h = new Date().getHours();
  if (h >= 5 && h <= 6) return "dawn";
  if (h >= 7 && h <= 11) return "morning";
  if (h >= 12 && h <= 16) return "afternoon";
  if (h >= 17 && h <= 19) return "dusk";
  return "night";
}

// ---------------------------------------------------------------------------
// Pond
// ---------------------------------------------------------------------------

export const POND_TX = 17;
export const POND_TY = 4;
export const POND_TW = 5;
export const POND_TH = 4;

export function inPond(wx: number, wy: number): boolean {
  const tx = Math.floor(wx / TS);
  const ty = Math.floor(wy / TS);
  // Include 1-tile border so characters don't walk right up to the edge
  return (
    tx >= POND_TX - 1 &&
    tx < POND_TX + POND_TW + 1 &&
    ty >= POND_TY - 1 &&
    ty < POND_TY + POND_TH + 1
  );
}

// ---------------------------------------------------------------------------
// Desk zones
// ---------------------------------------------------------------------------

export const DESK_ZONES: DeskZone[] = [
  // Top row — monitor at top, character faces up
  {
    id: "lunary",
    deskX: 1 * TS,
    deskY: 1 * TS,
    seatX: 2.5 * TS,
    seatY: 2.5 * TS,
    facing: "up" as Dir,
    monitorGlow: "#7c3aed",
    label: "LUNA",
    hitX: 1 * TS - TS,
    hitY: 1 * TS - TS / 2,
    hitW: 5 * TS,
    hitH: 5 * TS,
  },
  {
    id: "spellcast",
    deskX: 7 * TS,
    deskY: 1 * TS,
    seatX: 8.5 * TS,
    seatY: 2.5 * TS,
    facing: "up" as Dir,
    monitorGlow: "#0e7490",
    label: "CASTER",
    hitX: 7 * TS - TS,
    hitY: 1 * TS - TS / 2,
    hitW: 5 * TS,
    hitH: 5 * TS,
  },
  // Bottom row — monitor at bottom, character faces down
  {
    id: "dev",
    deskX: 1 * TS,
    deskY: 9 * TS,
    seatX: 2.5 * TS,
    seatY: 8.5 * TS,
    facing: "down" as Dir,
    monitorGlow: "#166534",
    label: "DEV",
    hitX: 1 * TS - TS,
    hitY: 8 * TS - TS,
    hitW: 5 * TS,
    hitH: 5 * TS,
  },
  {
    id: "meta",
    deskX: 7 * TS,
    deskY: 9 * TS,
    seatX: 8.5 * TS,
    seatY: 8.5 * TS,
    facing: "down" as Dir,
    monitorGlow: "#9d174d",
    label: "META",
    hitX: 7 * TS - TS,
    hitY: 8 * TS - TS,
    hitW: 5 * TS,
    hitH: 5 * TS,
  },
];

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

export const FURNITURE: FurniturePiece[] = [
  // Office rugs
  { id: "rug1", type: "rug", tx: 3, ty: 4, tw: 5, th: 3, c1: "#7848a0", c2: "#9060c0" },
  // Break area (bottom of office)
  { id: "rug2", type: "rug", tx: 1, ty: 11, tw: 4, th: 2, c1: "#d05040", c2: "#e87060" },
  { id: "sofa1", type: "sofa", tx: 1, ty: 11, tw: 3, th: 2 },
  { id: "ctable", type: "coffeetable", tx: 4, ty: 11, tw: 2, th: 1 },
  { id: "plant1", type: "plant", tx: 10, ty: 11, tw: 1, th: 1, variant: 3 },
  // Office extras
  { id: "whiteboard", type: "whiteboard", tx: 4, ty: 5, tw: 3, th: 1 },
  { id: "watercooler", type: "watercooler", tx: 8, ty: 5, tw: 1, th: 1 },
  { id: "filing1", type: "filing", tx: 10, ty: 3, tw: 1, th: 2 },
];

// ---------------------------------------------------------------------------
// Outdoor decorations (seeded placement)
// ---------------------------------------------------------------------------

function gardenOk(tx: number, ty: number): boolean {
  return (
    tx >= 13 &&
    tx <= 31 &&
    ty >= 0 &&
    ty < WORLD_ROWS &&
    !(tx >= POND_TX && tx < POND_TX + POND_TW && ty >= POND_TY && ty < POND_TY + POND_TH)
  );
}

// Flowers (tile coords + colour for drawFlower)
const SPRING_F_BASE = ["#ffb0c8", "#ffe080", "#f8f0ff", "#ffd0e8"];
const flRng = seededRng("flow-v3");
export const FLOWERS: { tx: number; ty: number; col: string }[] = [];
while (FLOWERS.length < 20) {
  const tx = 13 + Math.floor(flRng() * 19);
  const ty = 1 + Math.floor(flRng() * (WORLD_ROWS - 2));
  if (gardenOk(tx, ty)) {
    FLOWERS.push({ tx, ty, col: SPRING_F_BASE[FLOWERS.length % SPRING_F_BASE.length] });
  }
}

// Trees (world coords for drawTree)
const trRng = seededRng("trees-v3");
export const TREES: { wx: number; wy: number; sz: number }[] = [];
while (TREES.length < 14) {
  const tx = 13 + Math.floor(trRng() * 19);
  const ty = 1 + Math.floor(trRng() * (WORLD_ROWS - 2));
  if (gardenOk(tx, ty)) {
    TREES.push({ wx: tx * TS, wy: ty * TS, sz: 9 + trRng() * 14 });
  }
}

// Benches (tile coords for drawBench)
const bnRng = seededRng("bench-v2");
export const BENCHES: { tx: number; ty: number }[] = [];
while (BENCHES.length < 3) {
  const tx = 13 + Math.floor(bnRng() * 16);
  const ty = 2 + Math.floor(bnRng() * (WORLD_ROWS - 4));
  if (gardenOk(tx, ty)) {
    BENCHES.push({ tx, ty });
  }
}

// ---------------------------------------------------------------------------
// Garden decorations (rocks, bushes, signpost)
// ---------------------------------------------------------------------------

const decRng = seededRng("garden-deco-v2");
export const ROCKS: { tx: number; ty: number; variant: number }[] = [];
while (ROCKS.length < 8) {
  const tx = 13 + Math.floor(decRng() * 19);
  const ty = 1 + Math.floor(decRng() * (WORLD_ROWS - 2));
  if (gardenOk(tx, ty)) {
    ROCKS.push({ tx, ty, variant: Math.floor(decRng() * 4) });
  }
}

const bushRng = seededRng("bushes-v1");
export const BUSHES: { tx: number; ty: number; variant: number }[] = [];
while (BUSHES.length < 6) {
  const tx = 13 + Math.floor(bushRng() * 19);
  const ty = 1 + Math.floor(bushRng() * (WORLD_ROWS - 2));
  if (gardenOk(tx, ty)) {
    BUSHES.push({ tx, ty, variant: Math.floor(bushRng() * 2) });
  }
}

// Signpost near the office door
export const SIGNPOST = { tx: 13, ty: 5 };

// ---------------------------------------------------------------------------
// Activity spots
// ---------------------------------------------------------------------------

export const BREAK_SPOTS: [number, number][] = [
  [2 * TS, 11.5 * TS],
  [4 * TS, 12 * TS],
  [1.5 * TS, 11 * TS],
];

// OUTDOOR_SPOTS defined after walkability grid (see below)

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export const ACTIVITIES_OUTDOOR = [
  "stargazing",
  "daydreaming",
  "stretching",
  "exploring",
  "wandering",
];

export const ACTIVITIES_BREAK = [
  "relaxing",
  "scrolling",
  "chatting",
  "on phone",
  "zoning out",
];

export const ACTIVITIES_BENCH = ["sitting", "resting", "people-watching"];

// ---------------------------------------------------------------------------
// Flower colours per season
// ---------------------------------------------------------------------------

const SPRING_F = ["#ffb0c8", "#ffe080", "#f8f0ff", "#ffd0e8"];
const SUMMER_F = ["#ff6090", "#ffd840", "#80f0a0", "#f080d0"];
const AUTUMN_F = ["#e07020", "#d0a020", "#c04810", "#a06010"];

export const FLOWER_COLS: Record<Season, string[]> = {
  spring: SPRING_F,
  summer: SUMMER_F,
  autumn: AUTUMN_F,
  winter: [],
};

// ---------------------------------------------------------------------------
// Walkability grid
// ---------------------------------------------------------------------------

export const WALKABLE: boolean[][] = Array.from({ length: WORLD_ROWS }, () =>
  Array.from({ length: WORLD_COLS }, () => true),
);

// Office walls — top (row 0) and bottom (row 13)
for (let c = 0; c < OFFICE_COLS; c++) {
  WALKABLE[0][c] = false;
  WALKABLE[WORLD_ROWS - 1][c] = false;
}

// Office walls — left (col 0) and right (col 11, except door)
for (let r = 0; r < WORLD_ROWS; r++) {
  WALKABLE[r][0] = false;
  if (r < DOOR_ROW_START || r > DOOR_ROW_END) {
    WALKABLE[r][OFFICE_COLS - 1] = false;
  }
}

// Desk tiles (3-wide at each desk position)
// Top row desks at ty=1
for (let dx = 0; dx < 3; dx++) {
  WALKABLE[1][1 + dx] = false; // LUNA desk
  WALKABLE[1][7 + dx] = false; // CASTER desk
}
// Bottom row desks at ty=9
for (let dx = 0; dx < 3; dx++) {
  WALKABLE[9][1 + dx] = false; // DEV desk
  WALKABLE[9][7 + dx] = false; // META desk
}

// Furniture blocking
for (const f of FURNITURE) {
  const tw = f.tw ?? 1;
  const th = f.th ?? 1;
  for (let r = f.ty; r < f.ty + th && r < WORLD_ROWS; r++) {
    for (let c = f.tx; c < f.tx + tw && c < WORLD_COLS; c++) {
      WALKABLE[r][c] = false;
    }
  }
}

// Chair tiles (don't walk through seated characters)
// Top row: desk at row 1, seat at row 2
for (let dx = 0; dx < 3; dx++) {
  WALKABLE[2][1 + dx] = false; // LUNA seat
  WALKABLE[2][7 + dx] = false; // CASTER seat
}
// Bottom row: desk at row 9, seat at row 8
for (let dx = 0; dx < 3; dx++) {
  WALKABLE[8][1 + dx] = false; // DEV seat
  WALKABLE[8][7 + dx] = false; // META seat
}

// Pond tiles + 1-tile border
for (let r = POND_TY - 1; r < POND_TY + POND_TH + 1; r++) {
  for (let c = POND_TX - 1; c < POND_TX + POND_TW + 1; c++) {
    if (r >= 0 && r < WORLD_ROWS && c >= 0 && c < WORLD_COLS) {
      WALKABLE[r][c] = false;
    }
  }
}

// Tree trunk tiles (block the tile the tree is on)
for (const t of TREES) {
  const ttx = Math.floor(t.wx / TS);
  const tty = Math.floor(t.wy / TS);
  if (tty >= 0 && tty < WORLD_ROWS && ttx >= 0 && ttx < WORLD_COLS) {
    WALKABLE[tty][ttx] = false;
  }
}

// River tiles (rows 14-16, full width)
for (let r = RIVER_START_ROW; r < WORLD_ROWS; r++) {
  for (let c = 0; c < WORLD_COLS; c++) {
    WALKABLE[r][c] = false;
  }
}

// Rock tiles
for (const r of ROCKS) {
  if (r.ty >= 0 && r.ty < WORLD_ROWS && r.tx >= 0 && r.tx < WORLD_COLS) {
    WALKABLE[r.ty][r.tx] = false;
  }
}

// Bush tiles
for (const b of BUSHES) {
  if (b.ty >= 0 && b.ty < WORLD_ROWS && b.tx >= 0 && b.tx < WORLD_COLS) {
    WALKABLE[b.ty][b.tx] = false;
  }
}

// Signpost
if (SIGNPOST.ty >= 0 && SIGNPOST.ty < WORLD_ROWS && SIGNPOST.tx >= 0 && SIGNPOST.tx < WORLD_COLS) {
  WALKABLE[SIGNPOST.ty][SIGNPOST.tx] = false;
}

// Lantern tiles
const LANTERN_TILES: [number, number][] = [
  [13, 3], [13, 9], [20, 2], [20, 10], [26, 5], [26, 9],
];
for (const [lx, ly] of LANTERN_TILES) {
  if (ly >= 0 && ly < WORLD_ROWS && lx >= 0 && lx < WORLD_COLS) {
    WALKABLE[ly][lx] = false;
  }
}

// Bench tiles (3 wide)
for (const b of BENCHES) {
  for (let dx = 0; dx < 3; dx++) {
    const bc = b.tx + dx;
    if (b.ty >= 0 && b.ty < WORLD_ROWS && bc >= 0 && bc < WORLD_COLS) {
      WALKABLE[b.ty][bc] = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Outdoor spots (must be after walkability grid)
// ---------------------------------------------------------------------------

const orRng = seededRng("outdoor-spots");
const _rawOutdoor: [number, number][] = [];
let _orSafety = 0;
while (_rawOutdoor.length < 7 && _orSafety < 100) {
  _orSafety++;
  const tx = 13 + Math.floor(orRng() * 19);
  const ty = 1 + Math.floor(orRng() * (WORLD_ROWS - 2));
  if (gardenOk(tx, ty) && WALKABLE[ty]?.[tx]) {
    _rawOutdoor.push([tx * TS, ty * TS]);
  }
}
export const OUTDOOR_SPOTS: [number, number][] = [
  ...BENCHES.map(b => [(b.tx + 1) * TS, (b.ty + 1) * TS] as [number, number]),
  ..._rawOutdoor,
];

// ---------------------------------------------------------------------------
// BFS Pathfinding
// ---------------------------------------------------------------------------

export function findPath(
  fromTX: number,
  fromTY: number,
  toTX: number,
  toTY: number,
): [number, number][] | null {
  // Clamp to grid bounds
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max - 1));
  const sx = clamp(fromTX, WORLD_COLS);
  const sy = clamp(fromTY, WORLD_ROWS);
  let gx = clamp(toTX, WORLD_COLS);
  let gy = clamp(toTY, WORLD_ROWS);

  // If start equals goal, no movement needed
  if (sx === gx && sy === gy) return [];

  // If goal tile is blocked, find the nearest walkable adjacent tile
  if (!WALKABLE[gy]?.[gx]) {
    const dirs: [number, number][] = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    let bestDist = Infinity;
    let bestTile: [number, number] | null = null;
    for (const [dx, dy] of dirs) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (
        nx >= 0 &&
        nx < WORLD_COLS &&
        ny >= 0 &&
        ny < WORLD_ROWS &&
        WALKABLE[ny][nx]
      ) {
        const dist = Math.abs(nx - sx) + Math.abs(ny - sy);
        if (dist < bestDist) {
          bestDist = dist;
          bestTile = [nx, ny];
        }
      }
    }
    if (!bestTile) return null;
    gx = bestTile[0];
    gy = bestTile[1];
  }

  if (sx === gx && sy === gy) return [];

  // BFS
  const key = (x: number, y: number) => y * WORLD_COLS + x;
  const visited = new Set<number>();
  const prev = new Map<number, number>();
  const queue: [number, number][] = [[sx, sy]];
  visited.add(key(sx, sy));

  const dirs: [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;

    if (cx === gx && cy === gy) {
      // Reconstruct path (exclusive of start, inclusive of goal)
      const path: [number, number][] = [];
      let cur = key(gx, gy);
      const startKey = key(sx, sy);
      while (cur !== startKey) {
        const tx = cur % WORLD_COLS;
        const ty = Math.floor(cur / WORLD_COLS);
        path.push([tx, ty]);
        cur = prev.get(cur)!;
      }
      path.reverse();
      return path;
    }

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (
        nx >= 0 &&
        nx < WORLD_COLS &&
        ny >= 0 &&
        ny < WORLD_ROWS &&
        WALKABLE[ny][nx] &&
        !visited.has(key(nx, ny))
      ) {
        visited.add(key(nx, ny));
        prev.set(key(nx, ny), key(cx, cy));
        queue.push([nx, ny]);
      }
    }
  }

  return null; // No path found
}
