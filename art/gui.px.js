include("palette.px.js")

// 9-slice frame: 8px corners, 1px dark outline, bevel lit from top-left.
function frame9(name, w, h, edge, face, light, shadow) {
  sprite(name, { w, h },
    rect(0, 0, w, h, "k"),
    rect(1, 1, w - 2, h - 2, edge),
    rect(1, 1, w - 3, 1, light), rect(1, 1, 1, h - 3, light),
    rect(2, h - 3, w - 3, 1, shadow), rect(w - 3, 2, 1, h - 3, shadow),
    rect(3, 3, w - 6, h - 6, face),
    // corner studs
    px(2, 2, light), px(w - 3, 2, edge), px(2, h - 3, edge), px(w - 3, h - 3, shadow))
}
frame9("panel", 24, 24, "b", "P", "n", "d")        // parchment on wood trim
frame9("panel_dark", 24, 24, "m", "S", "l", "s")   // stone
frame9("btn", 24, 16, "n", "b", "B", "d")
frame9("btn_down", 24, 16, "d", "D", "b", "d")
frame9("btn_gold", 24, 16, "Y", "y", "w", "O")
frame9("btn_gold_down", 24, 16, "O", "o", "y", "o")
frame9("banner", 24, 16, "R", "r", "t", "R")

pal({ C: "#2f6bff" })
// Icons, 12x12.
sprite("crown", { w: 12, h: 12, selout: "k" }, `
  y...yy...y.
  yy.yYYy.yy.
  yyyyYYyyyy.
  yyyyyyyyyy.
  yOyyyyyyOy.
  yyyyyyyyyy.
  OOOOOOOOOO.`)
sprite("crown_empty", { base: "crown", swap: { y: "S", Y: "S", O: "s" } })
sprite("lock", { w: 12, h: 12 },
  ring(6, 4, 3, "m"), rect(2, 6, 8, 6, "y"), rect(2, 6, 8, 1, "Y"),
  rect(2, 11, 8, 1, "O"), vline(6, 8, 2, "k"))
sprite("speaker_on", { w: 12, h: 12 },
  rect(1, 4, 3, 4, "l"), poly([4, 4, 7, 1, 7, 11, 4, 8], "l"),
  vline(9, 4, 4, "Y"), vline(11, 2, 8, "y"))
sprite("speaker_off", { w: 12, h: 12 },
  rect(1, 4, 3, 4, "m"), poly([4, 4, 7, 1, 7, 11, 4, 8], "m"),
  line(9, 4, 11, 8, "R"), line(11, 4, 9, 8, "R"))
sprite("scroll", { w: 12, h: 12, selout: "k" }, `
  .ppppppppp.
  pPPPPPPPPpp
  .pbbbbbbpp.
  .pPPPPPPp..
  .pbbbbbbp..
  .pPPPPPPp..
  .pbbbbbPpp.
  pPPPPPPPPpp
  .ppppppppp.`)
sprite("hourglass", { w: 12, h: 12, selout: "k" }, `
  bbbbbbbbbb
  .qqqqqqqq.
  ..qqqqqq..
  ...qyyq...
  ....yy....
  ...qyyq...
  ..qyyyyq..
  .qyyyyyyq.
  bbbbbbbbbb`)
sprite("arrow_back", { w: 12, h: 12, selout: "k" }, `
  ....w.....
  ...ww.....
  ..wwwwwwww
  .wwwwwwwww
  ..wwwwwwww
  ...ww.....
  ....w.....`)
sprite("shield", { w: 12, h: 12, selout: "k" }, `
  mmmmmmmmmm
  mCCCmmRRRm
  mCCCmmRRRm
  mmmmmmmmmm
  mRRRmmCCCm
  .mRRmmCCm.
  ..mRmmCm..
  ...mmmm...`)

anim("coin", { w: 10, h: 10, frames: 4, fps: 8 }, (c) => {
  const rx = [4, 3, 1, 3][c.frame]
  c.ellipse(4.5, 4.5, rx, 4, "O")
  if (rx > 1) c.ellipse(4.5, 4.5, rx - 1, 3, "y")
  if (rx > 1) c.hline(3, 2, 1, "w")
  if (rx === 1) c.vline(4, 0, 9, "o")
})

// Treasure chest, 32x24, closed -> open with light spill.
anim("chest", { w: 32, h: 32, frames: 6, fps: 14, loop: false }, (c) => {
  const R = (x,y,w,h,k) => c.rect(x,y+8,w,h,k), H = (x,y,l,k) => c.hline(x,y+8,l,k), V = (x,y,l,k) => c.vline(x,y+8,l,k), P = (x,y,k) => c.px(x,y+8,k)
  const open = [0, 1, 2, 3, 4, 4][c.frame]
  // base
  R(2, 12, 28, 11, "D"); R(2, 12, 28, 2, "B"); R(2, 21, 28, 2, "d")
  R(2, 17, 28, 1, "d")
  V(2, 12, 11, "k"); V(29, 12, 11, "k"); H(2, 23, 28, "k")
  // light spill
  if (open > 0) {
    R(4, 12 - open * 2, 24, open * 2, "Y")
    R(8, 12 - open * 2, 16, open * 2, "w")
  }
  // lid (shrinks upward as it opens)
  const lh = 8 - open
  const ly = 12 - lh - open * 2
  R(2, ly, 28, lh, "b"); R(2, ly, 28, 2, "n"); H(2, ly + lh - 1, 28, "d")
  V(2, ly, lh, "k"); V(29, ly, lh, "k"); H(2, ly - 1, 28, "k")
  // straps and lock
  for (const x of [6, 23]) { R(x, ly, 3, lh, "o"); R(x, 12, 3, 11, "o") }
  R(14, 11 - open, 4, 5, "y"); P(15, 13 - open, "k")
})
