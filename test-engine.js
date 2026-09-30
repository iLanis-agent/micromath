/* MicroMath engine tests. Run: node test-engine.js */
var M = require('./engine.js');
var pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + name); }
}
function close(a, b, eps, name) { ok(Math.abs(a - b) <= (eps || 1e-9), name + ' (got ' + a + ', want ' + b + ')'); }
function throws(fn, name) {
  try { fn(); fail++; console.error('FAIL (no throw): ' + name); }
  catch (e) { pass++; }
}

/* --- core conversion, anchored to published worked examples --- */
// CleverCalculator / Nova: 4:00 at 1100 W -> 700 W = 6:17 (377.14 s)
var c1 = M.convertTime({ recipeWatts: 1100, yourWatts: 700, seconds: 240 });
close(c1.secondsExact, 240 * 1100 / 700, 1e-9, '1100->700 4min exact seconds');
ok(c1.display === '6:17', '1100->700 4min display 6:17, got ' + c1.display);
close(c1.pctChange, 57.142857, 1e-4, '1100->700 pct +57.14');
ok(c1.direction === 'longer', 'direction longer');
ok(c1.keypadDisplay === '6:15', 'keypad rounds 377.14 to 375 = 6:15, got ' + c1.keypadDisplay);

// CleverCalculator: 2:00 at 1000 W -> 1200 W = 1:40
var c2 = M.convertTime({ recipeWatts: 1000, yourWatts: 1200, seconds: 120 });
close(c2.secondsExact, 100, 1e-9, '1000->1200 2min exact 100s');
ok(c2.display === '1:40', '1000->1200 display 1:40');
ok(c2.direction === 'shorter', 'direction shorter');
close(c2.pctChange, -16.666667, 1e-4, '1000->1200 pct -16.67');

// Calculum: 3:30 at 1000 W -> 800 W = 4:23 (262.5 s)
var c3 = M.convertTime({ recipeWatts: 1000, yourWatts: 800, seconds: 210 });
close(c3.secondsExact, 262.5, 1e-9, '1000->800 3:30 exact 262.5');
ok(c3.display === '4:23' || c3.display === '4:22', '1000->800 display about 4:23, got ' + c3.display);

// same wattage, same level: identity
var c4 = M.convertTime({ recipeWatts: 900, yourWatts: 900, seconds: 75 });
ok(c4.direction === 'same' && c4.secondsExact === 75, 'identity conversion');

// AgentCalc: 1100 W @ 70% -> 700 W @ 100%, 330 s -> 363 s = 6:03
var c5 = M.convertTime({ recipeWatts: 1100, yourWatts: 700, seconds: 330, recipeLevel: 70, yourLevel: 100 });
close(c5.secondsExact, 363, 1e-9, 'level-aware 330s -> 363s');
ok(c5.display === '6:03', 'level-aware display 6:03, got ' + c5.display);
close(c5.recipeEffectiveWatts, 770, 1e-9, 'recipe effective 770 W');
close(c5.yourEffectiveWatts, 700, 1e-9, 'your effective 700 W');

// energy bookkeeping: effective W x time is conserved
var c6 = M.convertTime({ recipeWatts: 1000, yourWatts: 800, seconds: 480, recipeLevel: 50, yourLevel: 30 });
close(c6.energyJoules, 500 * 480, 1e-9, 'energy = 500 x 480');
close(c6.secondsExact * c6.yourEffectiveWatts, c6.energyJoules, 1e-6, 'energy conserved after conversion');
// Nova example: 1000W@50% 8:00 -> 800W@30% = 16:40 (1000 s)
ok(c6.display === '16:40', 'Nova worked example 16:40, got ' + c6.display);

// sameLevelSeconds ignores levels: 330 s, 1100 -> 700 = 518.57
close(c5.sameLevelSeconds, 330 * 1100 / 700, 1e-9, 'sameLevel alternative seconds');

/* --- formatting and keypad rounding --- */
ok(M.formatMMSS(65) === '1:05', 'format 1:05');
ok(M.formatMMSS(600) === '10:00', 'format 10:00');
ok(M.roundToKeypad(377.14) === 375, 'keypad 377 -> 375');
ok(M.roundToKeypad(378) === 380, 'keypad 378 -> 380');

/* --- cheat sheet --- */
var sheet = M.cheatSheet(1100, 240);
ok(sheet.length === M.COMMON_WATTS.length, 'sheet covers all common wattages');
ok(sheet[0].watts === 600 && sheet[0].seconds > sheet[sheet.length - 1].seconds, 'weaker oven = longer time');
var row1100 = sheet.filter(function (r) { return r.watts === 1100; })[0];
ok(row1100.seconds === 240, 'matching wattage returns original time');

/* --- water test, anchored to published worked example --- */
// zyra.info: 1500 cc, 19->30 C, 120 s -> 576 W
var w1 = M.waterTestWatts({ massG: 1500, startC: 19, endC: 30, seconds: 120 });
close(w1.watts, 1500 * 11 * 4.1868 / 120, 1e-9, 'water test exact');
ok(w1.wattsRounded === 580, 'water test rounds to 580, got ' + w1.wattsRounded);
ok(w1.nearestCommon === 600, 'water test nearest common 600');
// IEC 705 style: 1 L, +10 C in 60 s -> ~700 W
var w2 = M.waterTestWatts({ massG: 1000, startC: 10, endC: 20, seconds: 60 });
close(w2.watts, 4186.8 / 60 * 10 / 10 * 10, 1, 'IEC 1L sanity');
ok(w2.nearestCommon === 700, 'IEC 1L nearest 700');
close(w2.energyJoules, 4.1868 * 1000 * 10, 1e-9, 'water test energy');

/* --- quantity scaling heuristic --- */
var q = M.quantityScale(240, 2);
ok(q.factor === 1.5 && q.secondsExact === 360, 'two portions x1.5');
ok(q.display === '6:00', 'two portions display 6:00');
ok(q.heuristic === true, 'quantity flagged heuristic');
ok(M.quantityScale(240, 1).secondsExact === 240, 'one portion identity');

/* --- label decoder --- */
var ld = M.labelDecode(1500, 1000);
close(ld.efficiencyPct, 66.6667, 1e-3, 'label efficiency 66.7%');

/* --- validation --- */
throws(function () { M.convertTime({ recipeWatts: 0, yourWatts: 700, seconds: 60 }); }, 'reject 0 recipe watts');
throws(function () { M.convertTime({ recipeWatts: 5000, yourWatts: 700, seconds: 60 }); }, 'reject 5000 recipe watts');
throws(function () { M.convertTime({ recipeWatts: 1000, yourWatts: 700, seconds: 0 }); }, 'reject 0 seconds');
throws(function () { M.convertTime({ recipeWatts: 1000, yourWatts: 700, seconds: 60, recipeLevel: 0 }); }, 'reject 0 level');
throws(function () { M.convertTime({ recipeWatts: 1000, yourWatts: 700, seconds: 60, yourLevel: 101 }); }, 'reject 101 level');
throws(function () { M.waterTestWatts({ massG: 50, startC: 10, endC: 20, seconds: 60 }); }, 'reject 50 ml');
throws(function () { M.waterTestWatts({ massG: 1000, startC: 20, endC: 20, seconds: 60 }); }, 'reject zero deltaT');
throws(function () { M.waterTestWatts({ massG: 1000, startC: 20, endC: 25, seconds: 5 }); }, 'reject 5 s heat');
throws(function () { M.quantityScale(240, 2.5); }, 'reject fractional portions');
throws(function () { M.labelDecode(1000, 1500); }, 'reject output > input');

var verrs = M.validateConversionInputs({ recipeWatts: 1100, yourWatts: 700, seconds: 240, recipeLevel: 100, yourLevel: 100, standingSeconds: 120 });
ok(verrs.length === 0, 'clean inputs validate');
var verrs2 = M.validateConversionInputs({ recipeWatts: 50, yourWatts: 9999, seconds: 0, recipeLevel: 100, yourLevel: 100, standingSeconds: 120 });
ok(verrs2.length === 3, 'three bad fields -> three errors, got ' + verrs2.length);

console.log(pass + '/' + (pass + fail) + ' tests passed');
process.exit(fail ? 1 : 0);
