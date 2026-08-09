/* ----------------------------------------------------------------------------
 * PixelForestCanvas — advanced 2D pixel-art forest.
 *
 * Minecraft-style blocky, but each block is a 16×16 tile drawn with extra
 * pixel-grid detail (roughened edges, highlights, shadow lines, and texture
 * noise so it feels like a real miniature world, not flat squares).
 *
 * Layers (back→front):
 *   Sky      — gradient + moon + stars
 *   Mountains— back layer of tall triangles (dark green outline)
 *   Terrain  — undulating hills with grass above and dirt below
 *   Blocks   — the buildable world: trees, cabin, pond, bushes, flowers,
 *              lanterns, path — spawn in over time (progress 0→1)
 *   Foreground — animated pollen/sparks floating; cabin window blink
 * -------------------------------------------------------------------------- */

/* Each block definition */
interface BlockDef {
  row: number;  // row 0 = surface grass-world, >0 = above, <0 = below
  col: number;
  type: "dirt" | "grass" | "grass-top" | "path" | "trunk" | "leaf" | "bush" | "flower" |
        "water" | "water1" | "water2" | "water-edge" | "cabin-wall" | "cabin-roof" | "cabin-window" |
        "lantern" | "spark" | "hillside";
  placedAt: number; // 0..1 progress when this tile first appears
}

const tileSize = 16;

/* Colour palette — richer, almost like a real pixel-art palette */
const C: Record<string, string> = {
  grassTop:  "#4CAF50",
  grass:     "#388E3C",
  dirt1:     "#795548",
  dirt2:     "#6D4C41",
  path:      "#A1887F",
  trunk1:    "#5D4037",
  trunk2:    "#4E342E",
  leafG:     "#81C784",   // light green
  leafM:     "#4CAF50",   // mid green
  leafD:     "#2E7D32",   // dark green
  leafL:     "#A5D6A7",   // lightest leaf
  bush:      "#66BB6A",
  flowerY:   "#FFF176",   // yellow flower center
  flowerP:   "#F48FB1",   // pink petal hint
  water1:    "#29B6F6",   // bright water
  water2:    "#0288D1",   // deep water
  waterE:    "#01579B",   // pond edge
  cabinW:    "#8D6E63",
  cabinR:    "#6D4C41",
  cabinWinWin: "#FFE57F",   // lit window
  lanternB:  "#FB8C00",   // lantern body
  lanternGl:  "#FFF59D",   // lantern glow
  spark:     "#FFFFFF",
  hillside:   "#558B2F"   // distant hill
};

/* Terrain height map per column — creates undulating hills + a valley for pond */
function terrainHeight(col: number): number {
  // Base undulation using sine waves
  let h = 0;
  h += Math.sin(col * 0.14) * 2.2;
  h += Math.sin(col * 0.32 + 1.7) * 1.6;
  h += Math.cos(col * 0.08 + 3.1) * 0.8;
  // The pond area (col 38..50) is a dip
  if (col >= 37 && col <= 51) {
    h -= 2.5 + Math.sin((col - 37) / 14 * Math.PI) * 2.0;
  }
  return Math.round(h);
}

/* Build the full world map */
function buildMap(): BlockDef[] {
  const blocks: BlockDef[] = [];
  const W = 54; // total columns

  for (let c = 0; c < W; c++) {
    const th = terrainHeight(c);
    // Dirt column (under ground)
    for (let dy = -4; dy <= th - 1; dy++) {
      const colIndex = (dy + 4) % 2 === 0 ? "dirt1" : "dirt2";
      blocks.push({ row: dy, col: c, type: colIndex as any, placedAt: 0.02 });
    }
    // Grass surface cap
    blocks.push({ row: th, col: c, type: "grass-top", placedAt: 0.03 });

    // Path across the valley (flat walkable)
    if (c >= 22 && c <= 30) {
      blocks.push({ row: th, col: c, type: "path", placedAt: 0.04 });
    }
  }

  // ── Distant mountains (back layer) drawn separately in renderBg — skip here

  // ── Pond water (col 39..49, fills the valley dip) ──
  const pondY = terrainHeight(39);

  function isEdge(c: number) { return c <= 39 || c >= 49; }
  blocks.push({ row: pondY, col: 39, type: "water-edge", placedAt: 0.05 });
  blocks.push({ row: pondY, col: 49, type: "water-edge", placedAt: 0.05 });
  for (let c = 40; c <= 48; c++) {
    blocks.push({ row: pondY, col: c, type: "water1" as any, placedAt: 0.05 });
    if (c % 2 === 0) blocks.push({ row: pondY, col: c, type: "water2" as any, placedAt: 0.052 });
  }

  // ── Trees (with full canopy spread) ──
  const trees = [
    { col: 7,  height: 10, placStart: 0.10 },
    { col: 18, height: 12, placStart: 0.14 },
    { col: 32, height: 11, placStart: 0.18 },
    { col: 14, height: 8,  placStart: 0.12 },
  ];
  for (const t of trees) {
    const th = terrainHeight(t.col);
    const baseRow = th + 1;
    // Trunk
    for (let r = 0; r < t.height - 4; r++) {
      blocks.push({ row: baseRow + r, col: t.col, type: r % 2 === 0 ? "trunk1" as any : "trunk2" as any, placedAt: t.placStart + r * 0.015 });
    }
    // Canopy — multi-column spread
    const canopyRows: { dc: number; dr: number; leaf: string }[] = [];
    for (let dr = -2; dr <= 3; dr++) {
      const width = dr < 0 ? 1 : dr < 2 ? 2 : 3;
      for (let dc = -width; dc <= width; dc++) {
        const height = t.height - 3 + dr;
        const leaf = dr < 0 ? "leafD" : dr === 0 ? "leafM" : dr < 2 ? "leafG" : "leafL";
        canopyRows.push({ dc, dr, leaf });
      }
    }
    canopyRows.sort(() => Math.random() - 0.5); // plop in randomly for organic look
    canopyRows.forEach((l, i) => {
      blocks.push({ row: baseRow + t.height - 3 + l.dr, col: t.col + l.dc, type: l.leaf as any, placedAt: t.placStart + 0.22 + i * 0.009 });
    });
  }

  // ── Bushes scattered ──
  [4, 9, 21, 27, 34, 36].forEach((c, i) => {
    const th = terrainHeight(c);
    blocks.push({ row: th + 1, col: c, type: "bush", placedAt: 0.24 + i * 0.008 });
  });

  // ── Flowers ──
  [5, 10, 18, 22, 29, 35, 44].forEach((c, i) => {
    blocks.push({ row: terrainHeight(c) + 1, col: c, type: "flower" as any, placedAt: 0.28 + i * 0.006 });
  });

  // ── Small cabin (left-mid area) ──
  const cabCol = 13;
  const cabBase = terrainHeight(cabCol) + 1;
  // Wall
  for (let r = 0; r <= 2; r++) {
    for (let dc = -2; dc <= 2; dc++) {
      const isWall = r < 2 && Math.abs(dc) === 2;
      blocks.push({ row: cabBase + r, col: cabCol + dc, type: "cabin-wall" as any, placedAt: 0.38 + r * 0.04 });
    }
  }
  // Roof (A-shaped)
  for (let dc = -3; dc <= 3; dc++) {
    blocks.push({ row: cabBase + 3, col: cabCol + dc, type: "cabin-roof" as any, placedAt: 0.46 });
  }
  // Roof peak
  blocks.push({ row: cabBase + 4, col: cabCol, type: "cabin-roof" as any, placedAt: 0.48 });
  // Window (glow)
  blocks.push({ row: cabBase + 1, col: cabCol + 1, type: "cabin-window" as any, placedAt: 0.40 });

  // ── Lanterns ──
  trees.forEach((t, i) => {
    const th = terrainHeight(t.col);
    blocks.push({ row: th + 5, col: t.col, type: "lantern" as any, placedAt: t.placStart + 0.30 + i * 0.02 });
    blocks.push({ row: th + 4, col: t.col + 1, type: "lantern" as any, placedAt: t.placStart + 0.32 + i * 0.02 });
  });

  // ── Floating sparks (finishing touches) ──
  for (let i = 0; i < 28; i++) {
    const cx = (i * 2.4 + 5) % W;
    const ry = terrainHeight(Math.floor(cx)) + 4 + (i % 5);
    blocks.push({ row: ry, col: Math.floor(cx), type: "spark", placedAt: 0.52 + i * 0.012 });
  }

  return blocks;
}

const WORLD = buildMap();

/* ----------------------------------------------------------------------------
 * Draw helpers
 * -------------------------------------------------------------------------- */
interface RE {
  ctx: CanvasRenderingContext2D; W: number; H: number;
  tileSz: number; ox: number; oy: number; progress: number;
  time: number;  // global clock in seconds
}

function colorForType(type: string): string {
  return (C as any)[type] || "#888";
}

/* Draw one pixel block with rough edges + highlight */
function drawBlock(env: RE, col: number, row: number, type: string, settlePct = 1) {
  const { ctx, tileSz, ox, oy, W, H } = env;
  const px = ox + col * tileSz;
  const baseY = oy - row * tileSz;
  // Settle-in bounce: block falls from above
  const fallOffset = settlePct < 1 ? (1 - Math.pow(settlePct, 2)) * H * 0.28 : 0;
  const bx = Math.round(px + 1);
  const by = Math.round(baseY - fallOffset + 1);
  const bw = Math.round(tileSz - 2);
  const bh = Math.round(tileSz - 2);

  // Base fill
  ctx.fillStyle = colorForType(type);
  ctx.fillRect(bx, by, bw, bh);

  // ── Inner pixel-art detailing ──
  // Top-left highlight (light shines from top-left)
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(bx, by, bw, 2);
  ctx.fillRect(bx, by, 2, bh);

  // Bottom-right shadow
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(bx + bw - 2, by + 2, 2, bh - 4);
  ctx.fillRect(bx + 2, by + bh - 2, bw - 4, 2);

  // Subtle pixel noise — scatter inside dots for texture
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let i = 0; i < 3; i++) {
    const dx = 4 + ((col * 7 + row * 11 + i * 3) % (bw - 8));
    const dy = 4 + ((col * 13 + row * 7 + i * 5) % (bh - 8));
    ctx.fillRect(bx + dx, by + dy, 1, 1);
  }
  // Slight highlight dots
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  for (let i = 0; i < 1; i++) {
    const dx = 3 + ((col * 19 + row * 13) % (bw - 6));
    const dy = 3 + ((col * 23 + row * 17) % (bh - 6));
    ctx.fillRect(bx + dx, by + dy, 1, 1);
  }
}

/* Background render — sky gradient, moon, stars, mountains silhouette */
function renderBg(env: RE) {
  const { ctx, W, H, progress, time } = env;
  const dawn = progress * 0.4;

  // Sky
  const skyG = ctx.createLinearGradient(0, 0, 0, H);
  skyG.addColorStop(0, `rgb(${Math.floor(8 + dawn * 30)},${Math.floor(18 + dawn * 38)},${Math.floor(34 + dawn * 52)})`);
  skyG.addColorStop(0.7, `rgb(${Math.floor(5 + dawn * 14)},${Math.floor(10 + dawn * 18)},${Math.floor(18 + dawn * 26)})`);
  skyG.addColorStop(1, `rgb(${Math.floor(20 + dawn * 12)},${Math.floor(35 + dawn * 18)},${Math.floor(28 + dawn * 16)})`);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, W, H);

  // Moon
  if (progress < 0.7) {
    const moonAlpha = Math.max(0, 1 - progress * 1.5);
    const mx = W * 0.72, my = H * 0.10, mr = 38;
    ctx.fillStyle = `rgba(240, 245, 250, ${moonAlpha})`;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(mx + mr * 0.4, my - mr * 0.22, mr * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Stars
  if (progress < 0.5) {
    const starA = 1 - progress * 2;
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5) % W);
      const sy = ((i * 83.2 + 37) % (H * 0.45));
      const tw = Math.sin(time * 1.5 + i * 0.7) * 0.5 + 0.5;
      const alpha = (0.35 + tw * 0.55) * starA;
      const r = 0.5 + ((i % 4) * 0.35);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Distant mountains silhouette (back layer, dark-green triangles) ──
  ctx.fillStyle = `rgba(34, 49, 28, ${0.55 + dawn * 0.2})`;
  const baseY = env.oy - 1;
  const peaks: [number, number, number][] = [
    [0,   baseY - 60, 120],
    [90, baseY - 48, 140],
    [190, baseY - 72, 130],
    [310, baseY - 56, 160],
    [450, baseY - 44, 100],
  ];
  for (const [cx, cy, w] of peaks) {
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx + w * 0.3, cy);
    ctx.lineTo(cx + w, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

/* ── Animated particles ── */
interface P {
  x: number; y: number; vy: number; life: number; maxLife: number;
  r: number; col: string;
}
let _drawCount = 0;

/* Animation resolver — block's drop-in bounce + lifetime */
const _anim = new Map<string, number>();  // key → placedAt drawCount

function keyForBlock(b: BlockDef) { return `${b.row}_${b.col}_${b.type}`; }

/* ── Main draw function ── */
export function drawForestFrame(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  progress: number
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvasW / dpr;
  const H = canvasH / dpr;
  const tileSz = Math.max(10, Math.floor(Math.min(W / 56, H / 16)));
  const ox = (W - 54 * tileSz) / 2;
  const oy = H * 0.72;

  _drawCount++;
  const env: RE = { ctx, W: Math.floor(W), H: Math.floor(H),
    tileSz, ox, oy, progress, time: _drawCount / 60 };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderBg(env);

  // ── Draw blocks ──
  for (const b of WORLD) {
    if (progress < b.placedAt) continue;
    const key = keyForBlock(b);
    const placedFrame = _anim.get(key) ?? _drawCount;
    if (placedFrame === _drawCount) _anim.set(key, _drawCount);
    const framesSince = _drawCount - placedFrame;
    const settle = Math.min(1, framesSince / 18);
    drawBlock(env, b.col, b.row, b.type, settle);
  }

  // ── Lantern glow animation (extra overlay on lantern blocks) ──
  const lanternGlowAlpha = 0.22 + Math.sin(env.time * 3.0) * 0.08;
  for (const b of WORLD) {
    if (b.type !== "lantern" || progress < b.placedAt) continue;
    const bx = Math.round(ox + b.col * tileSz + tileSz * 0.25);
    const by = Math.round(oy - b.row * tileSz + tileSz * 0.25);
    const gr = tileSz * 0.9;
    ctx.fillStyle = `rgba(255, 245, 157, ${lanternGlowAlpha})`;
    ctx.beginPath(); ctx.arc(bx, by, gr, 0, Math.PI * 2); ctx.fill();
  }

  // ── Cabin window blink ──
  const blink = Math.sin(env.time * 2.5) > 0.1;
  for (const b of WORLD) {
    if (b.type !== "cabin-window" || progress < b.placedAt || !blink) continue;
    const bx = Math.round(ox + b.col * tileSz + 1);
    const by = Math.round(oy - b.row * tileSz + 1);
    ctx.fillStyle = "#FFF9C4";
    ctx.fillRect(bx, by, tileSz - 2, tileSz - 2);
  }

  // ── Water animation (horizontal shimmer lines over pond) ──
  for (let c = 40; c <= 48; c++) {
    for (const b of WORLD) {
      if ((b.type !== "water1" && b.type !== "water2") || b.col !== c || progress < b.placedAt) continue;
      const shimmerPhase = (env.time * 1.8 + c * 0.5) % 1;
      const shimmerX = ox + c * tileSz;
      const shimmerY = oy - b.row * tileSz + tileSz * (0.25 + shimmerPhase * 0.5);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(shimmerX + 1, shimmerY, tileSz - 2, 2);
    }
  }

  // ── Floating pollen / tiny glowing dots ──
  for (let i = 0; i < 18; i++) {
    const fx = ((i * 173.6 + 37) % env.W);
    const fy = ((i * 89.4 + 53 + env.time * 12) % env.H);
    const alpha = 0.2 + Math.sin(env.time * 2.4 + i) * 0.15;
    ctx.fillStyle = `rgba(110, 231, 183, ${alpha})`;
    ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}