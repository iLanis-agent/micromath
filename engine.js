/* MicroMath engine - microwave wattage translation.
   Pure functions, no DOM. Exported for Node tests and attached to window for the app.
   Core physics: energy = power x time. For the same food to reach the same doneness,
   P_recipe_effective x t_recipe = P_yours_effective x t_yours,
   so t_yours = t_recipe x (P_recipe x L_recipe) / (P_yours x L_yours).
   Power level is treated as average power (rated x level/100); on most ovens the
   magnetron cycles on/off, so the level also affects resting structure - the app
   advises keeping the printed level for delicate foods rather than converting it away.
   Standing time never scales: it is conduction, not microwave energy. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.MicroMath = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var CP = 4.1868; // J per gram per deg C for water
  var COMMON_WATTS = [600, 700, 800, 900, 1000, 1100, 1200, 1250];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function checkWatts(w, name) {
    if (!isNum(w) || w < 100 || w > 3000) {
      throw new Error((name || 'Wattage') + ' must be between 100 and 3000 W.');
    }
  }
  function checkLevel(l, name) {
    if (!isNum(l) || l < 1 || l > 100) {
      throw new Error((name || 'Power level') + ' must be between 1 and 100%.');
    }
  }
  function checkSeconds(s, name, max) {
    if (!isNum(s) || s < 1 || s > (max || 3600)) {
      throw new Error((name || 'Time') + ' must be between 1 second and 60 minutes.');
    }
  }

  function effectiveWatts(watts, levelPct) {
    checkWatts(watts); checkLevel(levelPct);
    return watts * levelPct / 100;
  }

  function formatMMSS(totalSeconds) {
    var s = Math.round(totalSeconds);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function roundToKeypad(totalSeconds) {
    // Microwave keypads take 5-second steps gracefully; round to nearest 5 s.
    return Math.round(totalSeconds / 5) * 5;
  }

  /* Main conversion. opts: {recipeWatts, yourWatts, seconds, recipeLevel=100, yourLevel=100}
     Returns exact and keypad-rounded times, the ratio, percent change, effective
     watts on both sides and the delivered-energy bookkeeping. */
  function convertTime(opts) {
    var rw = opts.recipeWatts, yw = opts.yourWatts;
    var rl = opts.recipeLevel == null ? 100 : opts.recipeLevel;
    var yl = opts.yourLevel == null ? 100 : opts.yourLevel;
    var t = opts.seconds;
    checkWatts(rw, 'Package wattage'); checkWatts(yw, 'Your wattage');
    checkLevel(rl, 'Package power level'); checkLevel(yl, 'Your power level');
    checkSeconds(t, 'Cooking time');
    var re = effectiveWatts(rw, rl), ye = effectiveWatts(yw, yl);
    var ratio = re / ye;
    var exact = t * ratio;
    var rounded = roundToKeypad(exact);
    return {
      secondsExact: exact,
      secondsRounded: rounded,
      display: formatMMSS(exact),
      keypadDisplay: formatMMSS(rounded),
      ratio: ratio,
      pctChange: (ratio - 1) * 100,
      direction: ratio > 1.0001 ? 'longer' : (ratio < 0.9999 ? 'shorter' : 'same'),
      recipeEffectiveWatts: re,
      yourEffectiveWatts: ye,
      energyJoules: re * t,
      // Level-matched alternative: if the recipe uses a reduced level, keeping the
      // same level on your oven preserves the resting structure the recipe expects.
      sameLevelSeconds: t * rw / yw
    };
  }

  /* Cheat sheet: same instruction across every common oven rating. */
  function cheatSheet(recipeWatts, seconds, recipeLevel) {
    var rl = recipeLevel == null ? 100 : recipeLevel;
    return COMMON_WATTS.map(function (w) {
      var c = convertTime({ recipeWatts: recipeWatts, yourWatts: w, seconds: seconds, recipeLevel: rl, yourLevel: 100 });
      return { watts: w, seconds: c.secondsRounded, display: c.keypadDisplay };
    });
  }

  /* Wattage finder: the calorimetric (IEC 705 style) water test.
     P = 4.1868 x mass(g) x deltaT(C) / time(s). 1 ml of water = 1 g.
     Household losses make this approximate; treat as +/- about 10%. */
  function waterTestWatts(opts) {
    var mass = opts.massG, t0 = opts.startC, t1 = opts.endC, sec = opts.seconds;
    if (!isNum(mass) || mass < 100 || mass > 2000) throw new Error('Water amount must be 100-2000 ml.');
    if (!isNum(t0) || t0 < 0 || t0 > 60) throw new Error('Start temperature must be 0-60 C.');
    if (!isNum(t1) || t1 <= t0 || t1 > 100) throw new Error('End temperature must be above the start and at most 100 C.');
    if (!isNum(sec) || sec < 10 || sec > 600) throw new Error('Heating time must be 10-600 seconds.');
    var dT = t1 - t0;
    var watts = CP * mass * dT / sec;
    return {
      watts: watts,
      wattsRounded: Math.round(watts / 10) * 10,
      deltaT: dT,
      nearestCommon: nearestCommon(watts),
      energyJoules: CP * mass * dT
    };
  }

  function nearestCommon(w) {
    var best = COMMON_WATTS[0];
    for (var i = 0; i < COMMON_WATTS.length; i++) {
      if (Math.abs(COMMON_WATTS[i] - w) < Math.abs(best - w)) best = COMMON_WATTS[i];
    }
    return best;
  }

  /* Multi-portion rule of thumb: energy need scales with mass, but heating is not
     perfectly linear (surface, shape, stirring). Common kitchen guidance is to add
     roughly half again for a second portion and check early. Labelled heuristic. */
  function quantityScale(seconds, portions) {
    checkSeconds(seconds, 'Single-portion time');
    if (!isNum(portions) || portions < 1 || portions > 4 || Math.floor(portions) !== portions) {
      throw new Error('Portions must be a whole number from 1 to 4.');
    }
    var factors = { 1: 1, 2: 1.5, 3: 2, 4: 2.5 };
    var exact = seconds * factors[portions];
    return {
      factor: factors[portions],
      secondsExact: exact,
      secondsRounded: roundToKeypad(exact),
      display: formatMMSS(roundToKeypad(exact)),
      heuristic: true
    };
  }

  /* Rating-plate decoder: input (drawn from the outlet) vs output (delivered to food). */
  function labelDecode(inputWatts, outputWatts) {
    checkWatts(inputWatts, 'Input wattage'); checkWatts(outputWatts, 'Output wattage');
    if (outputWatts > inputWatts) throw new Error('Output cannot exceed input.');
    return {
      efficiencyPct: outputWatts / inputWatts * 100,
      outputWatts: outputWatts,
      inputWatts: inputWatts
    };
  }

  function validateConversionInputs(o) {
    var errs = [];
    function push(cond, msg) { if (cond) errs.push(msg); }
    push(!isNum(o.recipeWatts) || o.recipeWatts < 100 || o.recipeWatts > 3000, 'Package wattage must be 100-3000 W.');
    push(!isNum(o.yourWatts) || o.yourWatts < 100 || o.yourWatts > 3000, 'Your wattage must be 100-3000 W.');
    push(!isNum(o.seconds) || o.seconds < 1 || o.seconds > 3600, 'Cooking time must be 1 second to 60 minutes.');
    push(!isNum(o.recipeLevel) || o.recipeLevel < 1 || o.recipeLevel > 100, 'Package power level must be 1-100%.');
    push(!isNum(o.yourLevel) || o.yourLevel < 1 || o.yourLevel > 100, 'Your power level must be 1-100%.');
    push(!isNum(o.standingSeconds) || o.standingSeconds < 0 || o.standingSeconds > 1800, 'Standing time must be 0-30 minutes.');
    return errs;
  }

  return {
    CP: CP,
    COMMON_WATTS: COMMON_WATTS,
    effectiveWatts: effectiveWatts,
    convertTime: convertTime,
    cheatSheet: cheatSheet,
    waterTestWatts: waterTestWatts,
    nearestCommon: nearestCommon,
    quantityScale: quantityScale,
    labelDecode: labelDecode,
    formatMMSS: formatMMSS,
    roundToKeypad: roundToKeypad,
    validateConversionInputs: validateConversionInputs
  };
});
