var ctx = require('./load')(), LSC = ctx.LSC;
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('ÉCHEC: ' + m); } }
var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

// 1. Hongrois vs force brute
function perms(a) { if (a.length <= 1) return [a.slice()]; var out = []; for (var i = 0; i < a.length; i++) { var r = a.slice(0, i).concat(a.slice(i + 1)); perms(r).forEach(function (p) { out.push([a[i]].concat(p)); }); } return out; }
for (var t = 0; t < 400; t++) {
  var n = 1 + Math.floor(rnd() * 6), m = 1 + Math.floor(rnd() * 6), c = [];
  for (var i = 0; i < n; i++) { var row = []; for (var j = 0; j < m; j++) row.push(Math.round(rnd() * 100)); c.push(row); }
  var asg = LSC.hungarian(c), k = Math.min(n, m), tot = 0, used = {};
  var cnt = 0;
  for (i = 0; i < n; i++) if (asg[i] >= 0) { tot += c[i][asg[i]]; cnt++; ok(!used[asg[i]], 'colonne réutilisée'); used[asg[i]] = 1; }
  ok(cnt === k, 'nombre affecté ' + cnt + ' vs ' + k);
  // brute force
  var best = 1e9, idx = []; for (j = 0; j < Math.max(n, m); j++) idx.push(j);
  perms(idx).forEach(function (p) { var s = 0; for (var ii = 0; ii < n; ii++) { if (p[ii] < m && ii < n) { if (n <= m) s += c[ii][p[ii]]; } } if (n > m) { s = 0; for (var jj = 0; jj < m; jj++) if (p[jj] < n) s += c[p[jj]][jj]; } if (s < best) best = s; });
  ok(Math.abs(best - tot) < 1e-9, 'hongrois non optimal ' + tot + ' vs ' + best + ' n=' + n + ' m=' + m);
}

// 2. pack
for (t = 0; t < 500; t++) {
  var nn = 1 + Math.floor(rnd() * 12), d = [], g = [];
  for (i = 0; i < nn; i++) d.push(rnd() * 100);
  d.sort(function (a, b) { return a - b; });
  for (i = 0; i < nn - 1; i++) g.push(rnd() * 15);
  var p = LSC.pack(d, g), feas = true;
  for (i = 0; i < nn - 1; i++) if (p[i + 1] - p[i] < g[i] - 1e-9) feas = false;
  ok(feas, 'pack non faisable');
  var f0 = 0; for (i = 0; i < nn; i++) f0 += (p[i] - d[i]) * (p[i] - d[i]);
  // perturbations faisables ne font pas mieux
  for (var q = 0; q < 20; q++) {
    var p2 = p.map(function (x) { return x + (rnd() - 0.5) * 2; }), f2 = 0, fe = true;
    for (i = 0; i < nn - 1; i++) if (p2[i + 1] - p2[i] < g[i]) fe = false;
    if (!fe) continue;
    for (i = 0; i < nn; i++) f2 += (p2[i] - d[i]) * (p2[i] - d[i]);
    ok(f2 >= f0 - 1e-6, 'pack pas optimal');
  }
  // déjà faisable => inchangé
  var spread = [], gg = []; for (i = 0; i < nn; i++) spread.push(i * 20); for (i = 0; i < nn - 1; i++) gg.push(10);
  var ps = LSC.pack(spread, gg), same = true; for (i = 0; i < nn; i++) if (Math.abs(ps[i] - spread[i]) > 1e-9) same = false;
  ok(same, 'pack modifie une position faisable');
}

// 3. repères canoniques
['L', 'R', 'T', 'B'].forEach(function (s) { for (var z = 0; z < 20; z++) { var pt = [rnd() * 100 - 50, rnd() * 100 - 50], b = LSC.fromC(LSC.toC(pt, s), s); ok(Math.abs(b[0] - pt[0]) < 1e-12 && Math.abs(b[1] - pt[1]) < 1e-12, 'aller-retour ' + s); } });

// 4. disposition en colonnes : jamais de croisement, pas de chevauchement, chaque trait finit sur SA cible
var MM = LSC.MM, modes = ['LR', 'L', 'R', 'TB', 'T', 'B'], cases = 0, compactKept = 0;
for (t = 0; t < 3000; t++) {
  var N = 1 + Math.floor(rnd() * 14), pairs = [], diag = [0, 300, 400, 0];
  for (i = 0; i < N; i++) {
    var tx = 20 + rnd() * 360, ty = 20 + rnd() * 260, w = 20 + rnd() * 80, h = 6 + rnd() * 20;
    var lx = rnd() * 500 - 50, ly = rnd() * 400 - 50;
    pairs.push({ label: i, box: [lx, ly + h, lx + w, ly], target: [tx, ty] });
  }
  var mode = modes[t % 6];
  var o = { margin: (2 + rnd() * 12) * MM, gapLabels: rnd() * 4 * MM, gapLine: rnd() * 2 * MM, elbow: rnd() < 0.5, elbowLen: rnd() * 8 * MM, distribution: rnd() < 0.5 ? 'near' : 'even', compact: rnd() < 0.5 };
  var res = LSC.layout(pairs, diag, mode, o), st = LSC.stats(res);
  cases++;
  ok(res.length === N, 'toutes les paires');
  ok(st.crossings === 0, 'croisement mode ' + mode + ' N=' + N + ' ' + JSON.stringify(o));
  ok(st.overlaps === 0, 'chevauchement mode ' + mode);
  ok(st.lineThroughLabel === 0, 'trait sur étiquette mode ' + mode);
  for (i = 0; i < res.length; i++) {
    var r = res[i], pr = pairs[r.pairIndex], end = r.line[r.line.length - 1];
    ok(r.label === pr.label && Math.abs(end[0] - pr.target[0]) < 1e-9 && Math.abs(end[1] - pr.target[1]) < 1e-9, 'cible conservée');
    ok(!LSC.boxesOverlap(r.newBox, diag, 0.01) , 'étiquette sur le dessin');
    ok(Math.abs((r.newBox[2] - r.newBox[0]) - (pr.box[2] - pr.box[0])) < 1e-9 && Math.abs(r.dx - (r.newBox[0] - pr.box[0])) < 1e-9, 'taille / déplacement cohérents');
    // départ du trait à l'écart voulu de l'étiquette
    var start = r.line[0], dd = LSC.distPointBox(start, r.newBox);
    ok(Math.abs(dd - o.gapLine) < 1e-6, 'écart texte-trait ' + dd + ' vs ' + o.gapLine);
  }
}

// 5. optimalité de la longueur (colonne, droit) vs force brute pour petits N
for (t = 0; t < 200; t++) {
  N = 2 + Math.floor(rnd() * 4); pairs = [];
  for (i = 0; i < N; i++) { tx = 50 + rnd() * 300; ty = rnd() * 300; pairs.push({ label: i, box: [0, 10, 40, 0], target: [tx, ty] }); }
  o = { margin: 10, gapLabels: 2, gapLine: 2, elbow: false, elbowLen: 0, distribution: 'near', compact: false };
  res = LSC.layout(pairs, [50, 300, 350, 0], 'L', o);
  var L0 = LSC.stats(res).length, starts = res.map(function (r) { return r.line[0]; });
  var bestL = 1e18; perms(starts.map(function (_, ii) { return ii; })).forEach(function (pp) { var s = 0; for (var ii = 0; ii < N; ii++) s += LSC.dist(starts[pp[ii]], pairs[ii].target); if (s < bestL) bestL = s; });
  ok(L0 <= bestL + 1e-6, 'longueur non minimale');
}

// 6. garder les places : jamais plus de croisements qu'avant, places réutilisées
var better = 0, totalBefore = 0, totalAfter = 0;
for (t = 0; t < 1500; t++) {
  N = 2 + Math.floor(rnd() * 9); pairs = [];
  for (i = 0; i < N; i++) {
    var hh = 10, ww = 40, x0 = rnd() < 0.5 ? -60 : 420, y0 = i * 25;
    pairs.push({ label: i, box: [x0, y0 + hh, x0 + ww, y0], target: [20 + rnd() * 360, rnd() * 260] });
  }
  o = { margin: 0, gapLabels: 0, gapLine: 2, elbow: rnd() < 0.5, elbowLen: 8, distribution: 'near', compact: false };
  var fx = LSC.stats(LSC.layoutFixed(pairs, o)), pm = LSC.layoutPermute(pairs, o), sp = LSC.stats(pm);
  totalBefore += fx.crossings; totalAfter += sp.crossings;
  ok(sp.crossings <= fx.crossings, 'permutation pire que fixe');
  for (i = 0; i < pm.length; i++) { end = pm[i].line[pm[i].line.length - 1]; ok(end[0] === pairs[pm[i].pairIndex].target[0], 'cible conservée (permute)'); }
}

// 7. appariement
var labels = [{ box: [0, 10, 40, 0], text: 'Écran' }, { box: [0, 40, 40, 30], text: 'Batterie' }, { box: [0, 70, 40, 60], text: 'Caméra' }];
var targets = [{ p: [200, 5], box: [195, 10, 205, 0], name: '', kind: 'object' }, { p: [210, 35], box: null, name: '', kind: 'point' }, { p: [150, 300], box: [140, 310, 160, 290], name: 'caméra', kind: 'object' }];
var leaders = [{ a: [41, 35], b: [200, 6] }];
var mm = LSC.match(labels, targets, leaders, 3 * MM);
ok(mm.by.lines === 1 && mm.by.names === 1 && mm.by.nearest === 1, 'méthodes ' + JSON.stringify(mm.by));
var lab = {}; mm.pairs.forEach(function (p) { lab[p.label] = p.target; });
ok(lab[1][0] === 200 && lab[1][1] === 6, 'trait : vise le point d\'arrivée du trait');
ok(lab[2][0] === 150, 'nom : Caméra');
ok(lab[0][0] === 210, 'proximité : Écran → point restant');
ok(mm.usedLeaders.length === 1 && mm.unmatchedLabels.length === 0, 'traits utilisés');
// trait dans l'autre sens, sans cible : l'extrémité devient la cible
mm = LSC.match([{ box: [100, 10, 140, 0], text: 'A' }], [], [{ a: [20, 20], b: [99, 5] }], 3 * MM);
ok(mm.pairs.length === 1 && mm.pairs[0].target[0] === 20, 'extrémité libre = cible');
// trait dont les deux bouts touchent l'étiquette : ignoré
mm = LSC.match([{ box: [100, 10, 140, 0], text: 'A' }], [{ p: [0, 0], box: null, name: '', kind: 'point' }], [{ a: [99, 5], b: [141, 5] }], 3 * MM);
ok(mm.usedLeaders.length === 0 && mm.by.nearest === 1, 'trait sur l\'étiquette ignoré');
// plus d'étiquettes que de cibles
mm = LSC.match([{ box: [0, 10, 10, 0], text: 'a' }, { box: [0, 30, 10, 20], text: 'b' }], [{ p: [50, 25], box: null, name: '', kind: 'point' }], [], 3);
ok(mm.pairs.length === 1 && mm.pairs[0].label === 1 && mm.unmatchedLabels.length === 1, 'étiquette en trop');
// rangement de traits croisés d'une vraie mise en page : 6 étiquettes en colonne, traits croisés
pairs = []; var tgt = [[300, 50], [300, 250], [250, 100], [320, 200], [280, 150], [260, 20]];
for (i = 0; i < 6; i++) pairs.push({ label: i, box: [0, 280 - i * 40, 60, 268 - i * 40], target: tgt[i] });
var before = LSC.stats(LSC.layoutFixed(pairs, { gapLine: 2, elbow: false })).crossings;
var after = LSC.stats(LSC.layout(pairs, [240, 260, 330, 10], 'L', { margin: 20, gapLabels: 3, gapLine: 2, elbow: true, elbowLen: 10, distribution: 'near', compact: true })).crossings;
ok(before > 0 && after === 0, 'exemple : ' + before + ' croisements → ' + after);
console.log('Exemple fiche produit : ' + before + ' croisements avant → ' + after + ' après');
console.log('Garder les places : ' + totalBefore + ' croisements (sans échange) → ' + totalAfter + ' (avec échanges) sur 1500 cas');
console.log('Cas de disposition aléatoires : ' + cases);
console.log('moteur : ' + pass + ' réussis, ' + fail + ' échecs');
process.exit(fail ? 1 : 0);
