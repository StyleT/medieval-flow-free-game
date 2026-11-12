include("palette.px.js")

// Left half of a brilliant-cut gem on a 20x18 canvas (mx mirrors it). Keys 1..4 = dark..light ramp.
// Crown on top, flat mid-tone pavilion face in the middle (that is where the colour mark goes).
const GEM_HALF = () => [
  poly([4, 0, 10, 0, 10, 18, 0, 7, 0, 5], "2"),
  poly([4, 0, 10, 0, 10, 7, 0, 7, 0, 5], "3"),
  poly([5, 1, 10, 1, 10, 4, 3, 4], "4"),
  hline(0, 7, 10, "1"),
  poly([0, 8, 4, 8, 10, 18], "3"),
  poly([4, 8, 10, 8, 10, 18], "2"),
  px(1, 5, "4"), px(2, 5, "4"), px(1, 6, "4"),
]

// Symmetric marks, left half only (the gem is mirrored). Each colour gets its own, so flows read without hue.
const MARKS = {
  A: ["...M", "...M"],
  B: ["MMMM"],
  C: ["...M", "...M", "...M", "...M"],
  D: ["...M", "...M", "MMMM", "MMMM", "...M"],
  E: ["MMMM", "M...", "M...", "MMMM"],
  F: ["...M", "..MM", ".MMM", "MMMM"],
  G: ["MMMM", ".MMM", "..MM", "...M"],
  H: ["...M", "..M.", ".M..", "M..."],
  I: ["M...", ".M..", "..M.", "...M"],
  J: ["M...", "MM..", "MMM.", "MM..", "M..."],
  K: ["MM..", "MM.."],
  L: ["...M", "..MM", ".MMM", "..MM", "...M"],
  M: ["MMMM", "...M", "...M", "...M"],
  N: ["M...", "M...", "M...", "MMMM"],
  O: ["MMMM", "....", "MMMM", "....", "MMMM"],
  P: ["MM..", "MM..", "....", "MM..", "MM.."],
}
const lumOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

for (const [letter, hex] of Object.entries(GEMS)) {
  shades("1234", hex, { spread: 0.4 })
  pal({ M: lumOf(hex) > 150 ? "#14101f" : "#fff4dc" })
  const rows = MARKS[letter]
  const top = 8
  sprite("gem_" + letter, { mx: true, selout: "k", w: 20, h: 18 },
    ...GEM_HALF(),
    ...rows.map((row, i) => grid(10 - row.length, top + i, row)))
}
sheet("gems", ["gem_*"], { cols: 8, pad: 2 })
sheet("tiles", ["floor_a", "floor_b", "floor_c", "block"], { cols: 4, pad: 2 })

// Flagstones 24x24: lit seam top/left, dark seam bottom/right so tiles join.
sprite("_floor_base", { w: 24, h: 24 },
  rect(0, 0, 24, 24, "u"),
  rect(1, 1, 22, 22, "U"),
  hline(0, 0, 24, "v"), vline(0, 0, 24, "v"),
  hline(1, 1, 22, "V"), vline(1, 1, 22, "V"),
  hline(1, 22, 23, "u"), vline(22, 1, 23, "u"))
sprite("floor_a", { base: "_floor_base" })
sprite("floor_b", { base: "_floor_base" }, line(5, 3, 9, 7, "u"), line(9, 7, 9, 11, "u"))
sprite("floor_c", { base: "_floor_base" }, hline(12, 12, 7, "u"), hline(15, 13, 4, "u"))
group("floor", ["floor_a", "floor_a", "floor_a", "floor_b", "floor_c"])

// Blocked cell: raised stone block, light top-left, shadow bottom-right.
sprite("block", { w: 24, h: 24 },
  rect(0, 0, 24, 24, "k"),
  rect(1, 1, 22, 22, "S"),
  rect(1, 1, 21, 3, "M"), rect(1, 1, 3, 21, "M"),
  rect(4, 4, 16, 16, "s"),
  rect(4, 4, 15, 2, "m"), rect(4, 4, 2, 15, "m"),
  rect(6, 18, 14, 2, "S"), rect(18, 6, 2, 14, "S"),
  line(8, 10, 12, 13, "S"), line(12, 13, 12, 16, "S"))

// Glint sweeping across a gem (overlay, 6 frames, 24x24 canvas).
anim("gem_shine", { w: 24, h: 24, frames: 6, fps: 10 }, (c) => {
  const d = c.frame * 5 - 4
  for (let i = 3; i < 19; i++) {
    const x = d + i, y = 23 - i
    if (x >= 0 && x < 24 && y >= 0 && y < 24) { c.px(x, y, "w"); if (x + 1 < 24) c.px(x + 1, y, "w") }
  }
})

// Four-point sparkle burst, 5 frames of 24x24.
anim("sparkle", { w: 24, h: 24, frames: 5, fps: 12 }, (c) => {
  const r = [2, 5, 8, 10, 5][c.frame]
  const col = c.frame < 3 ? "w" : "Y"
  c.hline(12 - r, 12, r * 2 + 1, col)
  c.vline(12, 12 - r, r * 2 + 1, col)
  c.hline(12 - r, 11, r * 2 + 1, col); c.vline(11, 12 - r, r * 2 + 1, col)
  if (r > 3) {
    const q = (r / 2) | 0
    for (const [dx, dy] of [[-q, -q], [q, q], [q, -q], [-q, q]]) c.px(12 + dx, 12 + dy, "y")
  }
})
