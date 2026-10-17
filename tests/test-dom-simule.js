// Tests sur un DOM Illustrator simulé (objets factices) : sélection, dialogue, application, relance.
var load = require('./load');
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('ÉCHEC: ' + m); } }

function makeEnv(opts) {
  opts = opts || {};
  var alerts = [], files = {}, created = [], removed = [];
  function Ctl(type, items) {
    var c = { type: type, children: [], preferredSize: {}, text: '', value: false, items: items || [] , _sel: null};
    c.add = function (t, b, a3) {
      var ch = Ctl(t, (t === 'dropdownlist') ? a3 : null);
      if (t !== 'dropdownlist' && typeof a3 === 'string') ch.text = a3;
      c.children.push(ch); allCtls.push(ch); return ch;
    };
    Object.defineProperty(c, 'selection', {
      get: function () { return c._sel === null ? null : { index: c._sel, text: c.items[c._sel] }; },
      set: function (v) { c._sel = (typeof v === 'number') ? v : (v ? v.index : null); }
    });
    return c;
  }
  var allCtls = [];
  function Window(type, title) {
    var w = Ctl('dialog'); allCtls.length = 0;
    w.show = function () {
      var btn = function (label) { for (var i = 0; i < allCtls.length; i++) if (allCtls[i].type === 'button' && allCtls[i].text === label) return allCtls[i]; };
      if (opts.onDialog) opts.onDialog(allCtls);
      btn('Analyser').onClick();
      env.analyse = allCtls.filter(function (c) { return c.type === 'edittext' && c.text.indexOf('Étiquettes') === 0; }).map(function (c) { return c.text; })[0];
      if (opts.cancel) btn('Annuler').onClick(); else btn('Appliquer').onClick();
    };
    w.close = function () {};
    return w;
  }
  function File(p) { this.p = p; this.exists = !!files[p]; this._lines = []; this.eof = true; }
  File.prototype.open = function (m) { this.m = m; if (m === 'r') { this._lines = (files[this.p] || '').split('\n').filter(Boolean); this._i = 0; this.eof = this._lines.length === 0; } else files[this.p] = ''; return true; };
  File.prototype.readln = function () { var l = this._lines[this._i++]; this.eof = this._i >= this._lines.length; return l; };
  File.prototype.writeln = function (s) { files[this.p] += s + '\n'; };
  File.prototype.close = function () {};

  var layer = { locked: false, visible: true, name: 'Calque 1' };
  function boundsOf(pts) { var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }); return [Math.min.apply(0, xs), Math.max.apply(0, ys), Math.max.apply(0, xs), Math.min.apply(0, ys)]; }
  function Path(pts, o) {
    o = o || {};
    var it = { typename: 'PathItem', layer: layer, locked: false, hidden: false, closed: !!o.closed, filled: !!o.filled, note: o.note || '', name: o.name || '', stroked: true };
    it.pathPoints = pts.map(function (p, i) { return { anchor: p, selected: (o.sel ? o.sel[i] : 2) }; });
    Object.defineProperty(it, 'geometricBounds', { get: function () { return boundsOf(it.pathPoints.map(function (q) { return q.anchor; })); } });
    Object.defineProperty(it, 'visibleBounds', { get: function () { return it.geometricBounds; } });
    it.setEntirePath = function (arr) { it.pathPoints = arr.map(function (p) { return { anchor: [p[0], p[1]], selected: 2 }; }); };
    it.remove = function () { it._removed = true; removed.push(it); };
    return it;
  }
  function Text(txt, b) {
    var it = { typename: 'TextFrame', contents: txt, layer: layer, locked: false, hidden: false, name: '', _b: b.slice() };
    Object.defineProperty(it, 'geometricBounds', { get: function () { return it._b.slice(); } });
    Object.defineProperty(it, 'visibleBounds', { get: function () { return it._b.slice(); } });
    it.translate = function (dx, dy) { it._b = [it._b[0] + dx, it._b[1] + dy, it._b[2] + dx, it._b[3] + dy]; };
    it.textRange = { characters: [{ characterAttributes: { fillColor: { typename: 'CMYKColor', cyan: 100 } } }] };
    return it;
  }
  layer.groupItems = { add: function () {
    var g = { typename: 'GroupItem', items: [], name: '' };
    g.pathItems = {
      add: function () { var p = Path([[0, 0]]); g.items.push(p); created.push(p); return p; },
      ellipse: function (top, left, w, h) { var p = Path([[left, top], [left + w, top - h]], { closed: true }); p.isEllipse = true; p.ellipse = [top, left, w, h]; g.items.push(p); created.push(p); return p; }
    };
    g.move = function () { g.moved = true; };
    env.groups.push(g); return g;
  } };
  var doc = { selection: [], documentColorSpace: opts.rgb ? 2 : 1,
    artboards: (function () { var a = [{ artboardRect: [-200, 400, 700, -200] }]; a.getActiveArtboardIndex = function () { return 0; }; return a; })() };
  var g = {
    app: { locale: opts.locale || 'fr_FR', documents: { length: opts.noDoc ? 0 : 1 }, activeDocument: doc, redraw: function () {} },
    $: { global: { LSC_NO_MAIN: true } },
    alert: function (m) { alerts.push(String(m)); },
    Window: Window, File: File, Folder: { userData: '/prefs' },
    PathPointSelection: { NOSELECTION: 1, ANCHORPOINT: 2 },
    DocumentColorSpace: { CMYK: 1, RGB: 2 }, ElementPlacement: { PLACEBEFORE: 1 },
    StrokeCap: { ROUNDENDCAP: 1 }, StrokeJoin: { ROUNDENDJOIN: 1 },
    CMYKColor: function () { this.typename = 'CMYKColor'; }, RGBColor: function () { this.typename = 'RGBColor'; }
  };
  var env = { g: g, doc: doc, alerts: alerts, files: files, created: created, removed: removed, groups: [], Path: Path, Text: Text, layer: layer };
  env.ctx = load(g);
  return env;
}

var LSCm = makeEnv().ctx.LSC;

// --- A. Fiche produit : 6 étiquettes en vrac, 6 points d'ancrage sélectionnés sur un tracé ---
var e = makeEnv();
var shape = e.Path([[100, 0], [100, 300], [300, 300], [300, 0], [200, 150], [150, 80], [250, 220], [120, 260]], { closed: true, filled: true, sel: [1, 2, 1, 2, 2, 2, 2, 2] });
var names = ['Écran', 'Batterie', 'Caméra', 'Haut-parleur', 'Bouton', 'Port USB-C'];
var labels = names.map(function (n, i) { return e.Text(n, [-50 + (i % 2) * 450, 280 - i * 45, -50 + (i % 2) * 450 + 40 + n.length * 3, 268 - i * 45]); });
e.doc.selection = labels.concat([shape]);
e.ctx.LSC_UI.main();
var lines = e.created.filter(function (p) { return p.note === '#legende'; }), dots = e.created.filter(function (p) { return p.note === '#legende-point'; });
ok(lines.length === 6 && dots.length === 6, 'A : 6 traits + 6 points (' + lines.length + '/' + dots.length + ')');
var pl = lines.map(function (p) { return p.pathPoints.map(function (q) { return q.anchor; }); });
ok(LSCm.countCrossings(pl) === 0, 'A : aucun croisement dans le document');
var ends = pl.map(function (l) { return l[l.length - 1].join(','); }).sort();
var expected = [[100, 300], [300, 0], [200, 150], [150, 80], [250, 220], [120, 260]].map(function (p) { return p.join(','); }).sort();
ok(JSON.stringify(ends) === JSON.stringify(expected), 'A : chaque trait finit sur un point d\'ancrage sélectionné');
var ov = 0; for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) if (LSCm.boxesOverlap(labels[i]._b, labels[j]._b, 0.01)) ov++;
ok(ov === 0, 'A : étiquettes sans chevauchement');
labels.forEach(function (l) { ok(l._b[2] <= 100 - 7.9 * LSCm.MM || l._b[0] >= 300 + 7.9 * LSCm.MM, 'A : étiquette hors du dessin ' + l.contents); });
ok(lines.every(function (p) { return p.strokeWidth === 0.5 && p.stroked && !p.filled && p.strokeColor.typename === 'CMYKColor' && p.strokeColor.black === 100; }), 'A : style des traits (0,5 pt, noir CMJN)');
ok(e.alerts.length === 1 && /Terminé/.test(e.alerts[0]) && /Croisements : 0/.test(e.alerts[0]), 'A : message final ' + e.alerts[0]);
ok(/par proximité/.test(e.analyse) && /Après : 0 croisement/.test(e.analyse), 'A : rapport Analyser');
ok(/margin=8/.test(e.files['/prefs/LegendesSansCroisement-prefs.txt']), 'A : réglages enregistrés');
ok(e.groups.length === 1 && e.groups[0].moved, 'A : groupe placé au-dessus des étiquettes');
// la forme est-elle intacte ?
ok(!shape._removed && shape.pathPoints.length === 8, 'A : dessin intact');

// --- B. Relance sur les étiquettes + traits du script (sans les cibles) : appariement par les traits ---
var oldLines = lines.slice(), oldDots = dots.slice();
// on dérange 2 étiquettes à la main
labels[0].translate(0, -120); labels[3].translate(30, 90);
var targetOf = {};
oldLines.forEach(function (p) { var a = p.pathPoints[0].anchor, last = p.pathPoints[p.pathPoints.length - 1].anchor; labels.forEach(function (l, k) { if (LSCm.distPointBox(a, l._b) < 4 || LSCm.distPointBox(a, [l._b[0], l._b[1] + (k === 0 ? 120 : (k === 3 ? -90 : 0)), l._b[2], l._b[3] + (k === 0 ? 120 : (k === 3 ? -90 : 0))]) < 4) targetOf[k] = last.join(','); }); });
// étiquettes 0 et 3 déplacées : leurs traits ne les touchent plus → on les recolle en déplaçant les traits avec (cas réel : déplacer étiquette + trait ensemble)
oldLines.forEach(function (p) { var a = p.pathPoints[0].anchor; if (LSCm.distPointBox(a, [labels[0]._b[0], labels[0]._b[1] + 120, labels[0]._b[2], labels[0]._b[3] + 120]) < 4) p.pathPoints[0].anchor = [a[0], a[1] - 120]; else if (LSCm.distPointBox(a, [labels[3]._b[0] - 30, labels[3]._b[1] - 90, labels[3]._b[2] - 30, labels[3]._b[3] - 90]) < 4) p.pathPoints[0].anchor = [a[0] + 30, a[1] + 90]; p.pathPoints = [p.pathPoints[0], p.pathPoints[p.pathPoints.length - 1]]; });
e.created.length = 0; e.alerts.length = 0;
e.doc.selection = labels.concat(oldLines, oldDots);
e.ctx.LSC_UI.main();
var lines2 = e.created.filter(function (p) { return p.note === '#legende'; });
ok(lines2.length === 6, 'B : 6 nouveaux traits');
ok(oldLines.every(function (p) { return p._removed; }) && oldDots.every(function (p) { return p._removed; }), 'B : anciens traits et points remplacés');
ok(/6 par trait existant/.test(e.analyse), 'B : appariement par les traits : ' + e.analyse.split('\n')[1]);
var pl2 = lines2.map(function (p) { return p.pathPoints.map(function (q) { return q.anchor; }); });
ok(LSCm.countCrossings(pl2) === 0, 'B : aucun croisement');
var keep = true;
lines2.forEach(function (p) { var a = p.pathPoints[0].anchor, last = p.pathPoints[p.pathPoints.length - 1].anchor; labels.forEach(function (l, k) { if (LSCm.distPointBox(a, l._b) < 2 * LSCm.MM && targetOf[k] && targetOf[k] !== last.join(',')) keep = false; }); });
ok(keep, 'B : chaque étiquette garde sa cible');
ok(/6 ancien\(s\) trait\(s\) remplacé\(s\)/.test(e.alerts[0]), 'B : message ' + e.alerts[0]);

// --- C. Messages ---
var c1 = makeEnv({ noDoc: true }); c1.ctx.LSC_UI.main(); ok(/Aucun document/.test(c1.alerts[0]), 'C : aucun document');
var c2 = makeEnv(); c2.ctx.LSC_UI.main(); ok(/Rien n.est sélectionné/.test(c2.alerts[0]), 'C : rien de sélectionné');
var c3 = makeEnv(); c3.doc.selection = [c3.Path([[0, 0], [10, 10], [0, 10]], { closed: true, filled: true })]; c3.ctx.LSC_UI.main(); ok(/Aucune étiquette/.test(c3.alerts[0]), 'C : aucune étiquette');
var c4 = makeEnv(); c4.doc.selection = [c4.Text('A', [0, 10, 10, 0])]; c4.ctx.LSC_UI.main(); ok(/Aucune cible/.test(c4.alerts[0]), 'C : aucune cible');
var c5 = makeEnv({ locale: 'en_US', noDoc: true }); c5.ctx.LSC_UI.main(); ok(/No document open/.test(c5.alerts[0]), 'C : anglais');
var c6 = makeEnv({ cancel: true }); c6.doc.selection = [c6.Text('A', [0, 10, 10, 0]), c6.Path([[100, 0], [110, 10], [100, 10]], { closed: true, filled: true })]; c6.ctx.LSC_UI.main(); ok(c6.created.length === 0 && c6.alerts.length === 0, 'C : Annuler ne modifie rien');
var c7 = makeEnv(); c7.layer.locked = true; c7.doc.selection = [c7.Text('A', [0, 10, 10, 0]), c7.Path([[100, 0], [110, 10], [100, 10]], { closed: true, filled: true })]; c7.ctx.LSC_UI.main(); ok(/verrouillé/.test(c7.alerts[0]) && c7.created.length === 0, 'C : calque verrouillé');

// --- D. Document RVB, couleur du texte, trait droit, sans point, mode « ne pas déplacer » ---
var d = makeEnv({ rgb: true, onDialog: function (ctls) {
  var dd = ctls.filter(function (c) { return c.type === 'dropdownlist'; });
  dd[0].selection = 7; // ne pas déplacer
  dd[2].selection = 1; // droit
  ctls.filter(function (c) { return c.type === 'checkbox'; }).forEach(function (c) { if (/Point au bout/.test(c.text)) c.value = false; if (/Couleur du texte/.test(c.text)) c.value = true; });
} });
var dl = d.Text('Logo', [0, 10, 30, 0]);
var marker = d.Path([[200, 50], [204, 54], [200, 54]], { closed: true, filled: true, name: 'logo' });
d.doc.selection = [dl, marker];
d.ctx.LSC_UI.main();
var dLines = d.created.filter(function (p) { return p.note === '#legende'; });
ok(dLines.length === 1 && d.created.length === 1, 'D : un trait, pas de point');
ok(dLines[0].strokeColor.cyan === 100, 'D : couleur du texte');
ok(dl._b[0] === 0 && dl._b[1] === 10, 'D : étiquette non déplacée');
ok(dLines[0].pathPoints.length === 2 && dLines[0].pathPoints[0].anchor[0] > 30, 'D : trait droit depuis le bord droit');
ok(/par nom/.test(d.analyse) && /1 par nom/.test(d.analyse), 'D : appariement par nom (logo)');

// --- E. Réglages relus ---
var e2 = makeEnv(); e2.files['/prefs/LegendesSansCroisement-prefs.txt'] = 'mode=L\nmargin=12\nelbow=false\nbogus=1\n';
var ctlsSeen = null;
e2.g.Window = (function (W) { return function (t, ti) { var w = W(t, ti); var s = w.show; w.show = function () { s(); }; return w; }; })(e2.g.Window);
var o = e2.ctx.LSC_UI.DEFAULTS; ok(o.mode === 'LR', 'E : valeurs par défaut intactes');
e2.doc.selection = [e2.Text('A', [0, 10, 10, 0]), e2.Path([[100, 0], [110, 10], [100, 10]], { closed: true, filled: true })];
e2.ctx.LSC_UI.main();
ok(/mode=L\n/.test(e2.files['/prefs/LegendesSansCroisement-prefs.txt']) && /margin=12/.test(e2.files['/prefs/LegendesSansCroisement-prefs.txt']) && /elbow=false/.test(e2.files['/prefs/LegendesSansCroisement-prefs.txt']), 'E : réglages relus puis réenregistrés');

console.log('DOM simulé : ' + pass + ' réussis, ' + fail + ' échecs');
process.exit(fail ? 1 : 0);
