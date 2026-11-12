declare module 'logic-solver' {
  export type Formula = string | { readonly __formula: true }
  export class Solution {
    getTrueVars(): string[]
  }
  export class Solver {
    require(...formulas: Formula[]): void
    solve(): Solution | null
    solveAssuming(formula: Formula): Solution | null
  }
  export function or(...formulas: Formula[]): Formula
  export function not(formula: Formula): Formula
  export function exactlyOne(...formulas: Formula[]): Formula
  const Logic: {
    Solver: typeof Solver
    or: typeof or
    not: typeof not
    exactlyOne: typeof exactlyOne
  }
  export default Logic
}
