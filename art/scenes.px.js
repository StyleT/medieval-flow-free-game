include("palette.px.js")

// Distant hills silhouette helper.
function hills(c, base, amp, col, seed) {
  const r = c.rng(seed)
  let ph = r() * 6
  for (let x = 0; x < c.w; x++) {
    const y = Math.round(base + Math.sin(x / 31 + ph) * amp + Math.sin(x / 13 + ph * 2) * amp * 0.3)
    c.rect(x, y, 1, c.h - y, col)
  }
}

sprite("_tower", { w: 18, h: 60 },
  rect(2, 10, 14, 50, "S"), rect(2, 10, 3, 50, "M"), rect(13, 10, 3, 50, "s"),
  rect(0, 4, 18, 8, "s"), rect(0, 4, 18, 2, "m"),
  ...[0, 4, 8, 12, 16].map((x) => rect(x, 0, 2, 5, "s")),
  rect(8, 22, 3, 7, "k"), rect(8, 22, 3, 1, "i"),
  poly([2, 0, 9, -6, 16, 0], "R"))

scene("scene_castle", { w: 320, h: 180 },
  layer("sky", rect(0, 0, 320, 180, "i"), grad(0, 0, 320, 110, "iIjJr", "v", 0.7)),
  layer("far", (c) => hills(c, 120, 6, "I", 3)),
  layer("mid", (c) => hills(c, 138, 8, "i", 7)),
  layer("keep",
    rect(110, 70, 100, 70, "S"), rect(110, 70, 100, 70, "S"),
    rect(110, 70, 18, 70, "M"), rect(192, 70, 18, 70, "s"),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => rect(110 + i * 15, 62, 9, 9, "s")),
    stamp("_tower", 90, 90), stamp("_tower", 212, 84),
    rect(148, 100, 24, 40, "k"), ellipse(160, 100, 12, 8, "k"),
    rect(150, 102, 20, 38, "D"), vline(160, 102, 38, "d"),
    ...[0, 1, 2].map((i) => rect(118 + i * 28, 80, 4, 8, "y"))),
  layer("ground", (c) => hills(c, 148, 4, "F", 11), rect(0, 160, 320, 20, "f")),
  layer("shade", { shade: true }, poly([212, 140, 300, 168, 320, 168, 320, 140], "k")))

scene("scene_hall", { w: 320, h: 180 },
  layer("wall", rect(0, 0, 320, 180, "s"),
    ...Array.from({ length: 12 }, (_, row) =>
      Array.from({ length: 11 }, (_, i) => box(i * 30 + (row % 2 ? 15 : 0) - 15, row * 15, 30, 15, "S")))
      .flat(), shade([0, 0, 320, 180], 1, 0.4)),
  layer("arches",
    ...[0, 1, 2].flatMap((i) => [
      rect(30 + i * 100, 40, 40, 110, "k"), ellipse(50 + i * 100, 40, 20, 20, "k"),
      rect(34 + i * 100, 44, 32, 106, "j"), ellipse(50 + i * 100, 44, 16, 16, "j"),
    ])),
  layer("floor", rect(0, 150, 320, 30, "d"), ...Array.from({ length: 8 }, (_, i) => vline(i * 40, 150, 30, "k")),
    hline(0, 150, 320, "b")),
  layer("shade", { shade: true }, rect(0, 0, 320, 14, "k")))

scene("scene_dungeon", { w: 320, h: 180 },
  layer("wall", rect(0, 0, 320, 180, "m"),
    ...Array.from({ length: 12 }, (_, row) =>
      Array.from({ length: 10 }, (_, i) => box(i * 34 + (row % 2 ? 17 : 0) - 17, row * 16, 34, 16, "s")))
      .flat()),
  layer("dark", { shade: true, density: 0.6 }, rect(0, 0, 320, 180, "k")),
  layer("bars", ...[0, 1].flatMap((i) => [
    rect(60 + i * 160, 50, 70, 80, "k"),
    ...Array.from({ length: 6 }, (_, j) => rect(64 + i * 160 + j * 12, 50, 3, 80, "m"))])),
  layer("floor", rect(0, 150, 320, 30, "S"), hline(0, 150, 320, "M")),
  layer("shade", { shade: true }, rect(0, 150, 320, 6, "k")))

// Cloud strip that tiles horizontally.
sprite("clouds", { w: 320, h: 40 },
  ...[[20, 20, 18], [70, 12, 12], [120, 24, 16], [180, 10, 14], [230, 22, 18], [280, 14, 12]].map(([x, y, r]) =>
    clip([0, 0, 320, 40], rect(x - r, y, r * 2, 4, "J"), ellipse(x, y, r, 5, "J"), ellipse(x + 4, y - 3, r * 0.6, 4, "J"))))

anim("torch", { w: 8, h: 16, frames: 4, fps: 8 }, (c) => {
  c.rect(3, 8, 2, 8, "d"); c.rect(2, 7, 4, 2, "m")
  const f = [0, 1, 2, 1][c.frame]
  c.ellipse(4, 4 - f / 2, 2 + (f ? 0 : 0), 4, "t")
  c.ellipse(4, 5, 1, 2, "y")
  if (f === 2) c.px(4, 0, "t")
})

anim("banner_wave", { w: 12, h: 24, frames: 6, fps: 6 }, (c) => {
  for (let y = 0; y < 22; y++) {
    const o = Math.round(Math.sin((y + c.frame * 4) / 3.5) * 1)
    c.rect(1 + o, y + 1, 10, 1, y % 8 < 2 ? "O" : "R")
  }
  c.rect(0, 0, 12, 2, "o")
})
