include("palette.px.js")

// Parchment with soft grass and dirt patches (low contrast so captions and nodes stay the focus).
sprite("map_tile", { w: 160, h: 160 },
  rect(0, 0, 160, 160, "P"),
  ...[[24, 30, 26, 9, "p"], [104, 92, 28, 10, "p"], [60, 136, 24, 8, "p"], [128, 20, 18, 7, "p"]].map(([x, y, rx, ry, c]) => ellipse(x, y, rx, ry, c)),
  ...[[110, 34, 14, 5], [30, 100, 16, 6]].map(([x, y, rx, ry]) => ellipse(x, y, rx, ry, "q")))

sprite("tree_a", { w: 14, h: 18, selout: "k" },
  rect(6, 12, 3, 6, "D"), ellipse(7, 6, 6, 6, "F"), ellipse(5, 4, 3, 3, "G"))
sprite("tree_b", { w: 12, h: 18, selout: "k" },
  rect(5, 14, 3, 4, "D"), poly([6, 0, 12, 14, 0, 14], "f"), poly([6, 0, 3, 8, 6, 8], "g"))
sprite("mountain_a", { w: 26, h: 18, selout: "k" },
  poly([13, 0, 26, 18, 0, 18], "M"), poly([13, 0, 8, 18, 0, 18, 8, 7], "S"),
  poly([13, 0, 17, 6, 13, 5, 9, 7], "w"))
sprite("hut", { w: 16, h: 14, selout: "k" },
  rect(2, 6, 12, 8, "q"), poly([0, 6, 8, 0, 16, 6], "R"), rect(7, 9, 3, 5, "D"))

function castle(name, body, roof, extra) {
  sprite(name, { w: 30, h: 30, selout: "k" },
    rect(3, 12, 24, 18, body), rect(3, 12, 6, 18, "M"), rect(21, 12, 6, 18, "s"),
    ...[3, 9, 15, 21].map((x) => rect(x, 7, 4, 6, body)),
    rect(12, 20, 6, 10, "d"), ellipse(15, 20, 3, 3, "d"),
    rect(6, 16, 2, 4, "k"), rect(22, 16, 2, 4, "k"),
    poly([11, 7, 15, -1, 19, 7], roof),
    ...(extra || []))
}
castle("node_castle", "S", "R")
castle("node_castle_cleared", "S", "R", [rect(15, -1, 1, 8, "d"), rect(16, -1, 7, 4, "Y")])
castle("node_castle_locked", "m", "s")
sprite("node_lock", { w: 8, h: 8 }, ring(4, 2, 2, "l"), rect(1, 4, 6, 4, "y"))

anim("node_current", { w: 30, h: 36, frames: 4, fps: 6 }, (c) => {
  const b = [0, 1, 2, 1][c.frame]
  c.rect(3, 18, 24, 18, "S"); c.rect(3, 18, 6, 18, "M"); c.rect(21, 18, 6, 18, "s")
  for (const x of [3, 9, 15, 21]) c.rect(x, 13, 4, 6, "S")
  c.rect(12, 26, 6, 10, "d"); c.rect(6, 22, 2, 4, "k"); c.rect(22, 22, 2, 4, "k")
  c.rect(15, 2 - b + 4, 1, 12, "d")
  c.rect(16, 2 - b + 4, 8, 4, "R"); c.rect(16, 2 - b + 4, 8, 1, "t")
})
