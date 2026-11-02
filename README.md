# Quick Maths

A daily five-minute, no-calculator drill for the TMUA, A-level Maths, Further Maths and STEP.

Fourteen kinds of question: mental arithmetic, surds, indices, binomials, logs, exact trig, number theory,
quadratics, standard form, sequences and series, polynomials, calculus, fractions and coordinate geometry.
Each has three levels that adapt to how you do. Questions you get wrong come back later; anything still
wrong is reviewed at the end with a push, then the full worked solution, every line labelled.

**Use it:** <https://vankolts.github.io/quick-maths/>. Progress is saved in your browser.

## Files
- `drill.html` — the whole app, one file (no build tools, no dependencies).
- `docs/index.html` — the page GitHub Pages serves, made from `drill.html` by `node scripts/build-site.mjs`.
- `scripts/verify.js` — checks every question type: answers recomputed independently, every worked start and
  every line of every full solution, and typed answers as the answer box writes them.
- `scripts/serve.mjs` — local preview on port 8126.

## Changing it
1. Edit `drill.html`.
2. `node scripts/verify.js` — must report `failures 0`.
3. `node scripts/build-site.mjs`, then commit and push.
