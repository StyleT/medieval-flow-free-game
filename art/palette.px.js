// Master palette for the medieval reskin. Included by every art file.
// Single-char keys, dark -> light inside each ramp.
pal({ k: "#14101f", w: "#fff4dc" })

// Stone (cool greys)
shades("sSmMl", "#7a7f94")
// Wood (browns)
shades("dDbBn", "#8a5a34")
// Parchment
shades("pPqQ", "#e6cf9c")
// Gold
shades("oOyY", "#e8b43a")
// Night sky indigo
shades("iIjJ", "#3a3f8c")
// Foliage
shades("fFgG", "#4f8f3e")
// Torch orange
shades("rRtT", "#e86a24")

// The 16 flow colours. Order and hues match --flow-A..P in theme.css.
const GEMS = {
  A: "#e2333c", B: "#1f9e57", C: "#346fff", D: "#ffd21a",
  E: "#ff8a1e", F: "#22d3e0", G: "#ff4fc3", H: "#d8405b",
  I: "#9754e4", J: "#eef0f6", K: "#8a90a0", L: "#a6e82a",
  M: "#c89a5c", N: "#5f71d4", O: "#17877e", P: "#ff9bb8",
}

// Board floor: deep indigo slate (contrast >= 3 against every gem colour), lighter seam on the lit side.
pal({ u: "#17142a", U: "#262338", v: "#34304d", V: "#47416a" })
