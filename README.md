# MicroMath

The microwave wattage translator. Package instructions are written for one oven
rating (usually 1100 W) and your oven is almost never that. MicroMath converts the
printed time to your actual oven, measures your real wattage with a water test,
prints a cheat sheet for every common rating, and keeps standing time untouched
(resting is conduction - it never scales).

**Live app:** open `app.html` (or the GitHub Pages URL).

## The math

- Core rule: energy is power x time. For the same doneness,
  `t_yours = t_package x (W_package x level_package) / (W_yours x level_yours)`.
- Power level is average power: `effective W = rated W x level / 100`. On most
  ovens the magnetron cycles on/off, so the printed level also shapes resting
  structure - keep it for delicate foods instead of converting it away.
- Wattage water test (calorimetric, IEC 705 style):
  `P = 4.1868 x mass(g) x deltaT(C) / time(s)`. Household losses make it +/- ~10%.
- Portion scaling is a labelled kitchen rule of thumb (2 portions ~ x1.5), not physics.

## Files

- `index.html` - landing page
- `app.html` - the app (translator, water test, cheat sheet, portions)
- `engine.js` - pure-math engine (also `require()`-able)
- `test-engine.js` - 50 engine tests: `node test-engine.js`

## Sources

- GE Appliances, adapting recipes for a different wattage (contentId=19485)
- GE Appliances, microwave performance water test (contentId=16857)
- SpikeVM microwave cooking-time converter (formula reference)
