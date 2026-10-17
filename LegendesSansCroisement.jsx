//@target illustrator
/*
 * LegendesSansCroisement.jsx  v1.0.0
 * (c) 2026 Amirouche Amwanes — Licence MIT
 *
 * FR : Range les étiquettes de légende (callouts) d'un schéma, d'une vue éclatée,
 *      d'une fiche produit ou d'une infographie en colonnes (ou rangées) propres,
 *      et trace des traits de rappel qui ne se croisent jamais. Chaque étiquette
 *      garde SA cible : le script choisit seulement l'emplacement (l'ordre) qui
 *      donne la longueur totale de traits la plus courte — et un appariement de
 *      longueur totale minimale n'a, mathématiquement, aucun croisement.
 * EN : Tidies the callout labels of a diagram, exploded view, product sheet or
 *      infographic into clean columns (or rows) and draws leader lines that never
 *      cross. Each label keeps ITS target: the script only chooses the slot
 *      (the order) that gives the shortest total leader length — and a
 *      minimum-total-length matching provably has no crossings.
 *
 * Aucun appel réseau, aucune collecte de données. / No network, no data collection.
 * Conseil : travaillez sur une copie. / Tip: work on a copy.
 * Statut : non testé dans Illustrator (syntaxe ES3 et logique testées hors Illustrator).
 */

/* ======================================================================
 *  MOTEUR (sans Illustrator) / ENGINE (no Illustrator needed)
 * ====================================================================== */
var LSC = (function () {
    var MM = 72 / 25.4;
    var BIG = 1e12;

    function dist(a, b) {
        var dx = a[0] - b[0], dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function fill(n, v) {
        var a = [];
        for (var i = 0; i < n; i++) a.push(v);
        return a;
    }

    /* Boîte = [gauche, haut, droite, bas] avec haut > bas (repère Illustrator, y vers le haut).
       Box = [left, top, right, bottom] with top > bottom (Illustrator, y up). */
    function boxCenter(b) { return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
    function boxW(b) { return b[2] - b[0]; }
    function boxH(b) { return b[1] - b[3]; }
    function unionBox(a, b) {
        if (!a) return b ? [b[0], b[1], b[2], b[3]] : null;
        if (!b) return a;
        return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
    }
    function pointBox(p) { return [p[0], p[1], p[0], p[1]]; }
    function distPointBox(p, b) {
        var dx = 0, dy = 0;
        if (p[0] < b[0]) dx = b[0] - p[0]; else if (p[0] > b[2]) dx = p[0] - b[2];
        if (p[1] > b[1]) dy = p[1] - b[1]; else if (p[1] < b[3]) dy = b[3] - p[1];
        return Math.sqrt(dx * dx + dy * dy);
    }
    function boxesOverlap(a, b, eps) {
        eps = eps || 0;
        return a[0] < b[2] - eps && b[0] < a[2] - eps && a[3] < b[1] - eps && b[3] < a[1] - eps;
    }
    function translateBox(b, dx, dy) { return [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]; }

    /* ---------- Affectation hongroise (coût minimal) / Hungarian assignment ----------
       cost : n lignes × m colonnes ; renvoie res[i] = colonne ou -1. */
    function hungarian(cost) {
        var n0 = cost.length;
        if (!n0) return [];
        var m0 = cost[0].length;
        if (!m0) return fill(n0, -1);
        var a = cost, n = n0, m = m0, transposed = false, i, j;
        if (n0 > m0) {
            a = [];
            for (j = 0; j < m0; j++) {
                var row = [];
                for (i = 0; i < n0; i++) row.push(cost[i][j]);
                a.push(row);
            }
            n = m0; m = n0; transposed = true;
        }
        var INF = 1e300;
        var u = fill(n + 1, 0), v = fill(m + 1, 0), p = fill(m + 1, 0), way = fill(m + 1, 0);
        for (i = 1; i <= n; i++) {
            p[0] = i;
            var j0 = 0;
            var minv = fill(m + 1, INF), used = fill(m + 1, false);
            do {
                used[j0] = true;
                var i0 = p[j0], delta = INF, j1 = 0;
                for (j = 1; j <= m; j++) {
                    if (!used[j]) {
                        var cur = a[i0 - 1][j - 1] - u[i0] - v[j];
                        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
                    }
                }
                for (j = 0; j <= m; j++) {
                    if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                    else minv[j] -= delta;
                }
                j0 = j1;
            } while (p[j0] !== 0);
            do {
                var jb = way[j0];
                p[j0] = p[jb];
                j0 = jb;
            } while (j0);
        }
        var res = fill(n, -1);
        for (j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
        if (!transposed) return res;
        var out = fill(n0, -1);
        for (i = 0; i < n; i++) if (res[i] >= 0) out[res[i]] = i;
        return out;
    }

    /* ---------- Croisements / crossings ---------- */
    function orient(a, b, c) {
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }
    function segmentsCross(p1, p2, p3, p4) {
        var s = Math.max(1, Math.abs(p1[0]) + Math.abs(p1[1]) + Math.abs(p3[0]) + Math.abs(p3[1]));
        var eps = 1e-9 * s * s;
        var d1 = orient(p3, p4, p1), d2 = orient(p3, p4, p2);
        var d3 = orient(p1, p2, p3), d4 = orient(p1, p2, p4);
        return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
               ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
    }
    function polylinesCross(a, b) {
        for (var i = 0; i < a.length - 1; i++)
            for (var j = 0; j < b.length - 1; j++)
                if (segmentsCross(a[i], a[i + 1], b[j], b[j + 1])) return true;
        return false;
    }
    function countCrossings(lines) {
        var c = 0;
        for (var i = 0; i < lines.length; i++)
            for (var j = i + 1; j < lines.length; j++)
                if (lines[i] && lines[j] && polylinesCross(lines[i], lines[j])) c++;
        return c;
    }
    function polylineLength(pl) {
        var L = 0;
        for (var i = 0; i < pl.length - 1; i++) L += dist(pl[i], pl[i + 1]);
        return L;
    }
    /* Un trait traverse-t-il une boîte (autre que la sienne) ? / Does a leader pass through a box? */
    function segmentHitsBox(p, q, b) {
        if (distPointBox(p, b) === 0 || distPointBox(q, b) === 0) return true;
        var c = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
        for (var k = 0; k < 4; k++) if (segmentsCross(p, q, c[k], c[(k + 1) % 4])) return true;
        return false;
    }
    function polylineHitsBox(pl, b) {
        for (var i = 0; i < pl.length - 1; i++) if (segmentHitsBox(pl[i], pl[i + 1], b)) return true;
        return false;
    }

    /* ---------- Placement 1D sans chevauchement (régression isotone, PAV) ----------
       desired[k] = position voulue, gaps[k] = écart minimal entre k et k+1.
       Renvoie les positions croissantes les plus proches (moindres carrés). */
    function pack(desired, gaps) {
        var n = desired.length, c = [0], k;
        for (k = 1; k < n; k++) c.push(c[k - 1] + gaps[k - 1]);
        var blocks = [];
        for (k = 0; k < n; k++) {
            blocks.push({ sum: desired[k] - c[k], cnt: 1 });
            while (blocks.length > 1) {
                var b2 = blocks[blocks.length - 1], b1 = blocks[blocks.length - 2];
                if (b1.sum / b1.cnt > b2.sum / b2.cnt) {
                    b1.sum += b2.sum; b1.cnt += b2.cnt; blocks.pop();
                } else break;
            }
        }
        var out = [], idx = 0;
        for (var bi = 0; bi < blocks.length; bi++) {
            var val = blocks[bi].sum / blocks[bi].cnt;
            for (var t = 0; t < blocks[bi].cnt; t++) { out.push(val + c[idx]); idx++; }
        }
        return out;
    }

    /* ---------- Repère canonique : la colonne est toujours « à gauche » ----------
       side : 'L' gauche, 'R' droite, 'T' haut, 'B' bas. u = vers l'intérieur, v = le long de la colonne. */
    function toC(p, side) {
        if (side === 'R') return [-p[0], p[1]];
        if (side === 'T') return [-p[1], p[0]];
        if (side === 'B') return [p[1], p[0]];
        return [p[0], p[1]];
    }
    function fromC(q, side) {
        if (side === 'R') return [-q[0], q[1]];
        if (side === 'T') return [q[1], -q[0]];
        if (side === 'B') return [q[1], q[0]];
        return [q[0], q[1]];
    }
    function boxToC(b, side) {
        var a = toC([b[0], b[1]], side), c = toC([b[2], b[3]], side);
        return { u0: Math.min(a[0], c[0]), u1: Math.max(a[0], c[0]), v0: Math.min(a[1], c[1]), v1: Math.max(a[1], c[1]) };
    }

    /* ---------- Disposition en colonne / column layout ----------
       pairs : [{label: index, box: [l,t,r,b], target: [x,y]}]
       diag  : boîte du dessin / diagram box. o : options (en points). */
    function layoutSide(pairs, side, diag, o) {
        var n = pairs.length, i, j;
        if (!n) return [];
        var dc = boxToC(diag, side);
        var T = [], H = [], W = [], maxH = 0, minTU = BIG;
        for (i = 0; i < n; i++) {
            T.push(toC(pairs[i].target, side));
            var bc = boxToC(pairs[i].box, side);
            W.push(bc.u1 - bc.u0); H.push(bc.v1 - bc.v0);
            if (H[i] > maxH) maxH = H[i];
            if (T[i][0] < minTU) minTU = T[i][0];
        }
        var uIn = Math.min(dc.u0, minTU) - o.margin;
        var portU = uIn + o.gapLine;
        var bendU = portU;
        if (o.elbow) {
            bendU = Math.min(portU + o.elbowLen, minTU - 0.25 * MM);
            if (bendU < portU) bendU = portU;
        }
        var pitch = maxH + o.gapLabels;
        var tv = [];
        for (i = 0; i < n; i++) tv.push(T[i][1]);
        tv.sort(function (a, b) { return a - b; });
        var slots;
        if (o.distribution === 'even' && n > 1) {
            var span = tv[n - 1] - tv[0], step = Math.max(pitch, span / (n - 1));
            var mid = (tv[0] + tv[n - 1]) / 2;
            slots = [];
            for (j = 0; j < n; j++) slots.push(mid - step * (n - 1) / 2 + j * step);
        } else {
            slots = pack(tv, fill(n - 1, pitch));
        }
        var cost = [];
        for (i = 0; i < n; i++) {
            var row = [];
            for (j = 0; j < n; j++) row.push(dist([bendU, slots[j]], T[i]));
            cost.push(row);
        }
        var asg = hungarian(cost);
        var res = buildColumn(pairs, side, T, W, H, slots, asg, uIn, portU, bendU);

        /* Variante compacte : écarts selon la taille réelle des étiquettes, gardée seulement
           si elle ne crée ni croisement ni chevauchement. */
        if (o.compact && n > 1) {
            var order = [];
            for (i = 0; i < n; i++) order.push(i);
            order.sort(function (a, b) { return asg[a] - asg[b]; });
            var desired = [], gaps = [];
            for (var k = 0; k < n; k++) {
                desired.push(o.distribution === 'even' ? slots[asg[order[k]]] : T[order[k]][1]);
                if (k < n - 1) gaps.push((H[order[k]] + H[order[k + 1]]) / 2 + o.gapLabels);
            }
            var pos = pack(desired, gaps);
            var slots2 = fill(n, 0), asg2 = fill(n, 0);
            for (k = 0; k < n; k++) { slots2[k] = pos[k]; asg2[order[k]] = k; }
            var res2 = buildColumn(pairs, side, T, W, H, slots2, asg2, uIn, portU, bendU);
            var lines2 = [];
            for (i = 0; i < n; i++) lines2.push(res2[i].line);
            if (countCrossings(lines2) === 0) res = res2;
        }
        return res;
    }

    function buildColumn(pairs, side, T, W, H, slots, asg, uIn, portU, bendU) {
        var out = [];
        for (var i = 0; i < pairs.length; i++) {
            var v = slots[asg[i]];
            var newC = { u0: uIn - W[i], u1: uIn, v0: v - H[i] / 2, v1: v + H[i] / 2 };
            var a = fromC([newC.u0, newC.v0], side), b = fromC([newC.u1, newC.v1], side);
            var nb = [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[0], b[0]), Math.min(a[1], b[1])];
            var old = pairs[i].box;
            var line = [fromC([portU, v], side)];
            if (bendU > portU + 1e-6) line.push(fromC([bendU, v], side));
            line.push(fromC(T[i], side));
            out.push({ label: pairs[i].label, pairIndex: i, newBox: nb, dx: nb[0] - old[0], dy: nb[1] - old[1], line: line, side: side });
        }
        return out;
    }

    /* ---------- Étiquettes gardées en place / labels kept in place ---------- */
    function attachSide(box, t) {
        if (t[0] < box[0]) return 'L';
        if (t[0] > box[2]) return 'R';
        if (t[1] > box[1]) return 'T';
        if (t[1] < box[3]) return 'B';
        return 'L';
    }
    /* Place une boîte de taille w×h dans un emplacement, alignée du côté du trait. */
    function fitInSlot(slot, w, h, s) {
        var cx = (slot[0] + slot[2]) / 2, cy = (slot[1] + slot[3]) / 2;
        if (s === 'L') return [slot[0], cy + h / 2, slot[0] + w, cy - h / 2];
        if (s === 'R') return [slot[2] - w, cy + h / 2, slot[2], cy - h / 2];
        if (s === 'T') return [cx - w / 2, slot[1], cx + w / 2, slot[1] - h];
        return [cx - w / 2, slot[3] + h, cx + w / 2, slot[3]];
    }
    function leaderFromBox(box, t, s, o) {
        var c = boxCenter(box), g = o.gapLine, p, line;
        if (s === 'L') p = [box[0] - g, c[1]];
        else if (s === 'R') p = [box[2] + g, c[1]];
        else if (s === 'T') p = [c[0], box[1] + g];
        else p = [c[0], box[3] - g];
        line = [p];
        if (o.elbow && o.elbowLen > 0) {
            var q;
            if (s === 'L') q = [Math.max(p[0] - o.elbowLen, t[0]), p[1]];
            else if (s === 'R') q = [Math.min(p[0] + o.elbowLen, t[0]), p[1]];
            else if (s === 'T') q = [p[0], Math.min(p[1] + o.elbowLen, t[1])];
            else q = [p[0], Math.max(p[1] - o.elbowLen, t[1])];
            if (dist(q, p) > 1e-6 && dist(q, t) > 1e-6) line.push(q);
        }
        line.push([t[0], t[1]]);
        return line;
    }
    function placeInSlots(pairs, slotBoxes, asg, o) {
        var out = [];
        for (var i = 0; i < pairs.length; i++) {
            var slot = slotBoxes[asg[i]], b = pairs[i].box, t = pairs[i].target;
            var s = attachSide(slot, t);
            var nb = fitInSlot(slot, boxW(b), boxH(b), s);
            out.push({ label: pairs[i].label, pairIndex: i, newBox: nb, dx: nb[0] - b[0], dy: nb[1] - b[1], line: leaderFromBox(nb, t, s, o), side: s });
        }
        return out;
    }
    function layoutPermute(pairs, o) {
        var n = pairs.length, i, j;
        if (!n) return [];
        var slots = [];
        for (i = 0; i < n; i++) slots.push(pairs[i].box);
        var cost = [];
        for (i = 0; i < n; i++) {
            var row = [];
            for (j = 0; j < n; j++) {
                var s = attachSide(slots[j], pairs[i].target);
                var nb = fitInSlot(slots[j], boxW(pairs[i].box), boxH(pairs[i].box), s);
                row.push(polylineLength(leaderFromBox(nb, pairs[i].target, s, o)));
            }
            cost.push(row);
        }
        var asg = hungarian(cost);
        var res = placeInSlots(pairs, slots, asg, o);
        /* 2-opt : échanges qui réduisent les croisements (puis la longueur). */
        var it = 0, improved = true;
        while (improved && it < 400) {
            improved = false; it++;
            var lines = [];
            for (i = 0; i < n; i++) lines.push(res[i].line);
            var cr = countCrossings(lines), len = 0;
            for (i = 0; i < n; i++) len += polylineLength(lines[i]);
            if (cr === 0) break;
            for (i = 0; i < n && !improved; i++) {
                for (j = i + 1; j < n && !improved; j++) {
                    if (!polylinesCross(lines[i], lines[j])) continue;
                    var a2 = asg.slice(0);
                    var tmp = a2[i]; a2[i] = a2[j]; a2[j] = tmp;
                    var r2 = placeInSlots(pairs, slots, a2, o), l2 = [], len2 = 0;
                    for (var k = 0; k < n; k++) { l2.push(r2[k].line); len2 += polylineLength(r2[k].line); }
                    var cr2 = countCrossings(l2);
                    if (cr2 < cr || (cr2 === cr && len2 < len - 1e-6)) { asg = a2; res = r2; improved = true; }
                }
            }
        }
        return res;
    }
    function layoutFixed(pairs, o) {
        var out = [];
        for (var i = 0; i < pairs.length; i++) {
            var b = pairs[i].box, s = attachSide(b, pairs[i].target);
            out.push({ label: pairs[i].label, pairIndex: i, newBox: b, dx: 0, dy: 0, line: leaderFromBox(b, pairs[i].target, s, o), side: s });
        }
        return out;
    }

    /* ---------- Plan complet / full plan ----------
       pairs : [{label, box, target}] ; mode : 'LR','L','R','TB','T','B','permute','fixed'. */
    function layout(pairs, diag, mode, o) {
        var res = [], i, groups = {}, sides = [];
        if (mode === 'permute') res = layoutPermute(pairs, o);
        else if (mode === 'fixed') res = layoutFixed(pairs, o);
        else {
            var c = boxCenter(diag);
            for (i = 0; i < pairs.length; i++) {
                var t = pairs[i].target, s;
                if (mode === 'LR') s = t[0] < c[0] ? 'L' : 'R';
                else if (mode === 'TB') s = t[1] > c[1] ? 'T' : 'B';
                else s = mode;
                if (!groups[s]) { groups[s] = []; sides.push(s); }
                groups[s].push(i);
            }
            var tmp = [];
            for (var si = 0; si < sides.length; si++) {
                var idx = groups[sides[si]], sub = [];
                for (i = 0; i < idx.length; i++) sub.push(pairs[idx[i]]);
                var r = layoutSide(sub, sides[si], diag, o);
                for (i = 0; i < r.length; i++) { r[i].pairIndex = idx[r[i].pairIndex]; tmp.push(r[i]); }
            }
            tmp.sort(function (a, b) { return a.pairIndex - b.pairIndex; });
            res = tmp;
        }
        return res;
    }

    function stats(res) {
        var lines = [], len = 0, overlaps = 0, hits = 0, i, j;
        for (i = 0; i < res.length; i++) { lines.push(res[i].line); len += polylineLength(res[i].line); }
        for (i = 0; i < res.length; i++)
            for (j = i + 1; j < res.length; j++)
                if (boxesOverlap(res[i].newBox, res[j].newBox, 0.01)) overlaps++;
        for (i = 0; i < res.length; i++)
            for (j = 0; j < res.length; j++)
                if (i !== j && polylineHitsBox(res[i].line, res[j].newBox)) { hits++; }
        return { crossings: countCrossings(lines), length: len, overlaps: overlaps, lineThroughLabel: hits };
    }

    /* ---------- Appariement étiquette ↔ cible / label ↔ target matching ----------
       labels  : [{box, text}] ; targets : [{p, box|null, name, kind}] ;
       leaders : [{a:[x,y], b:[x,y], own:bool}] (tracés ouverts : premier et dernier point).
       Renvoie {pairs:[{label, target}], targets (avec cibles ajoutées), used leaders, stats}. */
    function norm(s) {
        return String(s || '').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ').toLowerCase();
    }
    function match(labels, targets, leaders, tol) {
        var nL = labels.length, i, j, k;
        var labelT = fill(nL, -1), tUsed = [], by = { lines: 0, names: 0, nearest: 0 };
        var tg = targets.slice(0);
        for (i = 0; i < tg.length; i++) tUsed.push(false);
        var usedLeaders = [];
        for (k = 0; k < leaders.length; k++) {
            var ld = leaders[k], la = -1, lb = -1, da = BIG, db = BIG;
            for (i = 0; i < nL; i++) {
                var d1 = distPointBox(ld.a, labels[i].box), d2 = distPointBox(ld.b, labels[i].box);
                if (d1 < da) { da = d1; la = i; }
                if (d2 < db) { db = d2; lb = i; }
            }
            var li, far;
            if (da <= tol && (da <= db || db > tol)) { li = la; far = ld.b; }
            else if (db <= tol) { li = lb; far = ld.a; }
            else continue;
            if (distPointBox(far, labels[li].box) <= tol) continue; /* les deux bouts sur l'étiquette */
            usedLeaders.push(k);
            if (labelT[li] >= 0) continue;
            var best = -1, bd = BIG;
            for (j = 0; j < tg.length; j++) {
                var dj = tg[j].box ? distPointBox(far, tg[j].box) : dist(far, tg[j].p);
                if (dj < bd) { bd = dj; best = j; }
            }
            if (best >= 0 && bd <= tol && (!tUsed[best] || tg[best].kind === 'point')) {
                /* une cible-objet touchée par le trait : on vise le point d'arrivée du trait */
                if (tg[best].kind === 'object') {
                    tg.push({ p: [far[0], far[1]], box: null, name: '', kind: 'end', parent: best });
                    labelT[li] = tg.length - 1; tUsed.push(true); tUsed[best] = true;
                } else { labelT[li] = best; tUsed[best] = true; }
            } else {
                tg.push({ p: [far[0], far[1]], box: null, name: '', kind: 'end' });
                tUsed.push(true);
                labelT[li] = tg.length - 1;
            }
            by.lines++;
        }
        for (i = 0; i < nL; i++) {
            if (labelT[i] >= 0) continue;
            var nm = norm(labels[i].text);
            if (!nm) continue;
            for (j = 0; j < tg.length; j++) {
                if (!tUsed[j] && tg[j].name && norm(tg[j].name) === nm) {
                    labelT[i] = j; tUsed[j] = true; by.names++; break;
                }
            }
        }
        var freeL = [], freeT = [];
        for (i = 0; i < nL; i++) if (labelT[i] < 0) freeL.push(i);
        for (j = 0; j < tg.length; j++) if (!tUsed[j] && tg[j].kind !== 'end') freeT.push(j);
        if (freeL.length && freeT.length) {
            var cost = [];
            for (i = 0; i < freeL.length; i++) {
                var row = [], cc = boxCenter(labels[freeL[i]].box);
                for (j = 0; j < freeT.length; j++) row.push(dist(cc, tg[freeT[j]].p));
                cost.push(row);
            }
            var asg = hungarian(cost);
            for (i = 0; i < freeL.length; i++) {
                if (asg[i] >= 0) { labelT[freeL[i]] = freeT[asg[i]]; tUsed[freeT[asg[i]]] = true; by.nearest++; }
            }
        }
        var pairs = [], unL = [], unT = [];
        for (i = 0; i < nL; i++) {
            if (labelT[i] >= 0) pairs.push({ label: i, box: labels[i].box, target: tg[labelT[i]].p, targetIndex: labelT[i] });
            else unL.push(i);
        }
        for (j = 0; j < tg.length; j++) if (!tUsed[j] && !(tg[j].kind === 'object' && isParentOfEnd(tg, j))) unT.push(j);
        return { pairs: pairs, targets: tg, usedLeaders: usedLeaders, by: by, unmatchedLabels: unL, unmatchedTargets: unT };
    }
    function isParentOfEnd(tg, j) {
        for (var k = 0; k < tg.length; k++) if (tg[k].parent === j) return true;
        return false;
    }

    return {
        MM: MM, dist: dist, hungarian: hungarian, segmentsCross: segmentsCross, polylinesCross: polylinesCross,
        countCrossings: countCrossings, polylineLength: polylineLength, pack: pack, toC: toC, fromC: fromC,
        layoutSide: layoutSide, layout: layout, layoutPermute: layoutPermute, layoutFixed: layoutFixed,
        stats: stats, match: match, unionBox: unionBox, pointBox: pointBox, distPointBox: distPointBox,
        boxCenter: boxCenter, boxesOverlap: boxesOverlap, polylineHitsBox: polylineHitsBox, translateBox: translateBox
    };
})();

/* ======================================================================
 *  ILLUSTRATOR
 * ====================================================================== */
var LSC_UI = (function () {
    var FR = true;
    try { FR = String(app.locale || 'fr').toLowerCase().indexOf('fr') === 0; } catch (e) { FR = true; }
    function L(fr, en) { return FR ? fr : en; }
    var NOTE_LINE = '#legende', NOTE_DOT = '#legende-point';
    var PREFS_NAME = 'LegendesSansCroisement-prefs.txt';

    var DEFAULTS = {
        mode: 'LR', margin: 8, gapLabels: 2, distribution: 'near', compact: true,
        elbow: true, elbowLen: 4, gapLine: 1, stroke: 0.5, colorFromText: false,
        dot: true, dotSize: 1.2, replace: true, tol: 3
    };

    function loadPrefs() {
        var o = {}, k;
        for (k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) o[k] = DEFAULTS[k];
        try {
            var f = new File(Folder.userData + '/' + PREFS_NAME);
            if (f.exists && f.open('r')) {
                while (!f.eof) {
                    var line = f.readln(), p = line.indexOf('=');
                    if (p < 1) continue;
                    var key = line.substring(0, p), val = line.substring(p + 1);
                    if (!DEFAULTS.hasOwnProperty(key)) continue;
                    if (typeof DEFAULTS[key] === 'number') { var nv = parseFloat(val); if (!isNaN(nv)) o[key] = nv; }
                    else if (typeof DEFAULTS[key] === 'boolean') o[key] = (val === 'true');
                    else o[key] = val;
                }
                f.close();
            }
        } catch (e) { }
        return o;
    }
    function savePrefs(o) {
        try {
            var f = new File(Folder.userData + '/' + PREFS_NAME);
            if (f.open('w')) {
                for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) f.writeln(k + '=' + o[k]);
                f.close();
            }
        } catch (e) { }
    }

    function gb(item) {
        var b = item.geometricBounds;
        return [b[0], b[1], b[2], b[3]];
    }
    function vb(item) {
        var b = item.visibleBounds;
        return [b[0], b[1], b[2], b[3]];
    }
    function textOf(tf) { try { return String(tf.contents); } catch (e) { return ''; } }

    /* Lecture de la sélection / read the selection */
    function collect(doc) {
        var sel = doc.selection;
        var r = { labels: [], targets: [], leaders: [], leaderItems: [], dots: [], diagram: null, skipped: 0, pointTargets: 0, objectTargets: 0 };
        if (!sel || typeof sel.length !== 'number') return r;
        for (var i = 0; i < sel.length; i++) {
            var it = sel[i], tn = it.typename;
            if (it.locked || it.hidden) { r.skipped++; continue; }
            if (tn === 'TextFrame') {
                r.labels.push({ item: it, box: gb(it), text: textOf(it) });
                continue;
            }
            var note = '';
            try { note = String(it.note || ''); } catch (e) { }
            if (note === NOTE_DOT) { r.dots.push(it); continue; }
            if (tn === 'PathItem') {
                var pts = it.pathPoints, n = pts.length;
                if (note === NOTE_LINE || (!it.closed && n >= 2 && !it.filled)) {
                    if (n >= 2) {
                        var a = pts[0].anchor, b = pts[n - 1].anchor;
                        r.leaders.push({ a: [a[0], a[1]], b: [b[0], b[1]], own: note === NOTE_LINE, item: it });
                        r.leaderItems.push(it);
                        continue;
                    }
                }
                var selCount = 0, k;
                for (k = 0; k < n; k++) if (pts[k].selected == PathPointSelection.ANCHORPOINT) selCount++;
                if (selCount > 0 && selCount < n) {
                    for (k = 0; k < n; k++) {
                        if (pts[k].selected == PathPointSelection.ANCHORPOINT) {
                            var an = pts[k].anchor;
                            r.targets.push({ p: [an[0], an[1]], box: null, name: '', kind: 'point', item: it });
                            r.pointTargets++;
                        }
                    }
                    r.diagram = LSC.unionBox(r.diagram, vb(it));
                    continue;
                }
            }
            var bx = vb(it);
            r.targets.push({ p: LSC.boxCenter(bx), box: bx, name: String(it.name || ''), kind: 'object', item: it });
            r.objectTargets++;
            r.diagram = LSC.unionBox(r.diagram, bx);
        }
        return r;
    }

    function optsInPoints(o) {
        var MM = LSC.MM;
        return {
            margin: o.margin * MM, gapLabels: o.gapLabels * MM, gapLine: o.gapLine * MM,
            elbow: !!o.elbow, elbowLen: o.elbowLen * MM, distribution: o.distribution, compact: !!o.compact
        };
    }

    /* Calcule le plan sans rien modifier / compute the plan, no changes */
    function plan(col, o) {
        var labels = [], targets = [], leaders = [], i;
        for (i = 0; i < col.labels.length; i++) labels.push({ box: col.labels[i].box, text: col.labels[i].text });
        for (i = 0; i < col.targets.length; i++) targets.push({ p: col.targets[i].p, box: col.targets[i].box, name: col.targets[i].name, kind: col.targets[i].kind });
        for (i = 0; i < col.leaders.length; i++) leaders.push({ a: col.leaders[i].a, b: col.leaders[i].b, own: col.leaders[i].own });
        var m = LSC.match(labels, targets, leaders, o.tol * LSC.MM);
        var diag = col.diagram;
        for (i = 0; i < m.pairs.length; i++) diag = LSC.unionBox(diag, LSC.pointBox(m.pairs[i].target));
        /* traits sélectionnés qui ne touchent aucune étiquette : font partie du dessin */
        var usedMap = {};
        for (i = 0; i < m.usedLeaders.length; i++) usedMap[m.usedLeaders[i]] = true;
        for (i = 0; i < col.leaders.length; i++) {
            if (!usedMap[i] && !col.leaders[i].own) { try { diag = LSC.unionBox(diag, vb(col.leaders[i].item)); } catch (e) { } }
        }
        var res = diag ? LSC.layout(m.pairs, diag, o.mode, optsInPoints(o)) : [];
        /* croisements avant : traits existants / crossings before: existing leaders */
        var before = [];
        for (i = 0; i < col.leaders.length; i++) {
            var pts = col.leaders[i].item.pathPoints, pl = [];
            for (var k = 0; k < pts.length; k++) pl.push([pts[k].anchor[0], pts[k].anchor[1]]);
            before.push(pl);
        }
        return { match: m, res: res, stats: LSC.stats(res), crossingsBefore: LSC.countCrossings(before), diag: diag };
    }

    function blackColor(doc) {
        if (doc.documentColorSpace == DocumentColorSpace.CMYK) {
            var c = new CMYKColor(); c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 100; return c;
        }
        var r = new RGBColor(); r.red = 0; r.green = 0; r.blue = 0; return r;
    }
    function textColor(tf, doc) {
        try {
            var c = tf.textRange.characters[0].characterAttributes.fillColor;
            if (c && c.typename !== 'NoColor') return c;
        } catch (e) { }
        return blackColor(doc);
    }

    function apply(doc, col, pl, o) {
        var i, removed = 0;
        if (o.replace) {
            for (i = 0; i < pl.match.usedLeaders.length; i++) {
                try { col.leaders[pl.match.usedLeaders[i]].item.remove(); removed++; } catch (e) { }
            }
            for (i = 0; i < col.dots.length; i++) { try { col.dots[i].remove(); } catch (e2) { } }
        }
        if (!pl.res.length) return { lines: 0, moved: 0, removed: removed };
        var first = col.labels[pl.res[0].label].item;
        var layer = first.layer;
        var grp = layer.groupItems.add();
        grp.name = L('Traits de légende', 'Callout leaders');
        try { grp.move(first, ElementPlacement.PLACEBEFORE); } catch (e3) { }
        var moved = 0, sw = o.stroke, d = o.dotSize * LSC.MM;
        for (i = 0; i < pl.res.length; i++) {
            var r = pl.res[i], lab = col.labels[r.label].item;
            if (Math.abs(r.dx) > 0.001 || Math.abs(r.dy) > 0.001) { lab.translate(r.dx, r.dy); moved++; }
            var col0 = o.colorFromText ? textColor(lab, doc) : blackColor(doc);
            var p = grp.pathItems.add();
            p.setEntirePath(r.line);
            p.closed = false; p.filled = false; p.stroked = true;
            p.strokeWidth = sw; p.strokeColor = col0;
            try { p.strokeCap = StrokeCap.ROUNDENDCAP; p.strokeJoin = StrokeJoin.ROUNDENDJOIN; } catch (e4) { }
            p.note = NOTE_LINE;
            if (o.dot && d > 0) {
                var t = r.line[r.line.length - 1];
                var e = grp.pathItems.ellipse(t[1] + d / 2, t[0] - d / 2, d, d);
                e.stroked = false; e.filled = true; e.fillColor = col0; e.note = NOTE_DOT;
            }
        }
        return { lines: pl.res.length, moved: moved, removed: removed };
    }

    function f1(x) { return (Math.round(x * 10) / 10).toString().replace('.', FR ? ',' : '.'); }

    function report(col, pl) {
        var m = pl.match, s = pl.stats, t = [];
        t.push(L('Étiquettes : ', 'Labels: ') + col.labels.length + L(' — cibles : ', ' — targets: ') +
            (col.pointTargets + col.objectTargets) + ' (' + col.pointTargets + L(' points, ', ' points, ') + col.objectTargets + L(' objets)', ' objects)') +
            L(' — traits existants : ', ' — existing leaders: ') + col.leaders.length);
        t.push(L('Appariement : ', 'Matching: ') + m.by.lines + L(' par trait existant, ', ' by existing leader, ') +
            m.by.names + L(' par nom, ', ' by name, ') + m.by.nearest + L(' par proximité', ' by proximity'));
        if (m.unmatchedLabels.length) t.push(L('⚠ Étiquettes sans cible : ', '⚠ Labels without target: ') + m.unmatchedLabels.length);
        if (m.unmatchedTargets.length) t.push(L('⚠ Cibles sans étiquette : ', '⚠ Targets without label: ') + m.unmatchedTargets.length);
        t.push(L('Croisements des traits actuels : ', 'Crossings of current leaders: ') + pl.crossingsBefore);
        t.push(L('Après : ', 'After: ') + s.crossings + L(' croisement(s), longueur totale ', ' crossing(s), total length ') +
            f1(s.length / LSC.MM) + ' mm');
        if (s.overlaps) t.push(L('⚠ Étiquettes qui se chevauchent : ', '⚠ Overlapping labels: ') + s.overlaps);
        if (s.lineThroughLabel) t.push(L('⚠ Traits qui passent sur une autre étiquette : ', '⚠ Leaders crossing another label: ') + s.lineThroughLabel);
        if (col.skipped) t.push(L('Objets verrouillés ou masqués ignorés : ', 'Locked or hidden items skipped: ') + col.skipped);
        return t.join('\n');
    }

    function outsideArtboard(doc, pl) {
        try {
            var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            for (var i = 0; i < pl.res.length; i++) {
                var b = pl.res[i].newBox;
                if (b[0] < ab[0] || b[2] > ab[2] || b[1] > ab[1] || b[3] < ab[3]) return true;
            }
        } catch (e) { }
        return false;
    }

    var MODES = ['LR', 'L', 'R', 'TB', 'T', 'B', 'permute', 'fixed'];
    function modeNames() {
        return [L('Colonnes gauche + droite (auto)', 'Left + right columns (auto)'),
            L('Colonne à gauche', 'Left column'), L('Colonne à droite', 'Right column'),
            L('Rangées haut + bas (auto)', 'Top + bottom rows (auto)'),
            L('Rangée en haut', 'Top row'), L('Rangée en bas', 'Bottom row'),
            L('Garder les places (échanger les étiquettes)', 'Keep positions (swap labels)'),
            L('Ne pas déplacer (tracer seulement)', 'Do not move (draw only)')];
    }

    function dialog(doc, col, o) {
        var w = new Window('dialog', L('Légendes sans croisement', 'Crossing-free callouts') + ' v1.0.0');
        w.orientation = 'column'; w.alignChildren = 'fill';

        var p1 = w.add('panel', undefined, L('Disposition', 'Layout'));
        p1.alignChildren = 'left';
        var ddMode = p1.add('dropdownlist', undefined, modeNames());
        var mi = 0;
        for (var i = 0; i < MODES.length; i++) if (MODES[i] === o.mode) mi = i;
        ddMode.selection = mi;
        function numRow(parent, label, val, unit) {
            var g = parent.add('group');
            g.add('statictext', undefined, label).preferredSize.width = 230;
            var e = g.add('edittext', undefined, String(val).replace('.', FR ? ',' : '.'));
            e.characters = 6;
            g.add('statictext', undefined, unit);
            return e;
        }
        var eMargin = numRow(p1, L('Marge depuis le dessin', 'Margin from the drawing'), o.margin, 'mm');
        var eGapL = numRow(p1, L('Écart entre étiquettes', 'Gap between labels'), o.gapLabels, 'mm');
        var gD = p1.add('group');
        gD.add('statictext', undefined, L('Répartition', 'Distribution')).preferredSize.width = 230;
        var ddDist = gD.add('dropdownlist', undefined, [L('Près des cibles', 'Near targets'), L('Régulière', 'Even')]);
        ddDist.selection = o.distribution === 'even' ? 1 : 0;
        var cbCompact = p1.add('checkbox', undefined, L('Écarts selon la taille réelle de chaque étiquette', 'Spacing by each label\u2019s real size'));
        cbCompact.value = o.compact;

        var p2 = w.add('panel', undefined, L('Traits de rappel', 'Leader lines'));
        p2.alignChildren = 'left';
        var gS = p2.add('group');
        gS.add('statictext', undefined, L('Forme', 'Shape')).preferredSize.width = 230;
        var ddShape = gS.add('dropdownlist', undefined, [L('Coudé (départ horizontal)', 'Elbow (horizontal start)'), L('Droit', 'Straight')]);
        ddShape.selection = o.elbow ? 0 : 1;
        var eElbow = numRow(p2, L('Longueur du départ coudé', 'Elbow start length'), o.elbowLen, 'mm');
        var eGapLine = numRow(p2, L('Écart texte → trait', 'Text → line gap'), o.gapLine, 'mm');
        var eStroke = numRow(p2, L('Épaisseur', 'Weight'), o.stroke, 'pt');
        var cbDot = p2.add('checkbox', undefined, L('Point au bout du trait', 'Dot at the end'));
        cbDot.value = o.dot;
        var eDot = numRow(p2, L('Diamètre du point', 'Dot diameter'), o.dotSize, 'mm');
        var cbColor = p2.add('checkbox', undefined, L('Couleur du texte de l\u2019étiquette (sinon noir)', 'Label text colour (otherwise black)'));
        cbColor.value = o.colorFromText;

        var p3 = w.add('panel', undefined, L('Appariement', 'Matching'));
        p3.alignChildren = 'left';
        var cbRep = p3.add('checkbox', undefined, L('Remplacer les traits existants reliés aux étiquettes', 'Replace existing leaders attached to labels'));
        cbRep.value = o.replace;
        var eTol = numRow(p3, L('Tolérance de contact', 'Contact tolerance'), o.tol, 'mm');

        var info = w.add('edittext', undefined, L('Cliquez sur Analyser pour voir le résultat sans rien modifier.', 'Click Analyse to preview the result without changing anything.'), { multiline: true, readonly: true });
        info.preferredSize = [460, 150];

        var gb2 = w.add('group'); gb2.alignment = 'right';
        var bAn = gb2.add('button', undefined, L('Analyser', 'Analyse'));
        var bCancel = gb2.add('button', undefined, L('Annuler', 'Cancel'), { name: 'cancel' });
        var bOk = gb2.add('button', undefined, L('Appliquer', 'Apply'), { name: 'ok' });

        function num(e, def, min) {
            var v = parseFloat(String(e.text).replace(',', '.'));
            if (isNaN(v)) v = def;
            if (typeof min === 'number' && v < min) v = min;
            return v;
        }
        function read() {
            return {
                mode: MODES[ddMode.selection ? ddMode.selection.index : 0],
                margin: num(eMargin, DEFAULTS.margin, 0), gapLabels: num(eGapL, DEFAULTS.gapLabels, 0),
                distribution: (ddDist.selection && ddDist.selection.index === 1) ? 'even' : 'near',
                compact: cbCompact.value, elbow: !ddShape.selection || ddShape.selection.index === 0,
                elbowLen: num(eElbow, DEFAULTS.elbowLen, 0), gapLine: num(eGapLine, DEFAULTS.gapLine, 0),
                stroke: num(eStroke, DEFAULTS.stroke, 0.01), dot: cbDot.value, dotSize: num(eDot, DEFAULTS.dotSize, 0),
                colorFromText: cbColor.value, replace: cbRep.value, tol: num(eTol, DEFAULTS.tol, 0)
            };
        }
        bAn.onClick = function () {
            var oo = read(), pl = plan(col, oo), txt = report(col, pl);
            if (outsideArtboard(doc, pl)) txt += '\n' + L('⚠ Des étiquettes sortiraient du plan de travail actif.', '⚠ Some labels would leave the active artboard.');
            info.text = txt;
        };
        var result = null;
        bOk.onClick = function () { result = read(); w.close(1); };
        bCancel.onClick = function () { w.close(0); };
        w.show();
        return result;
    }

    function main() {
        if (!app.documents.length) {
            alert(L('Aucun document ouvert.\nOuvrez un document, sélectionnez les étiquettes (textes) et les cibles, puis relancez.',
                'No document open.\nOpen a document, select the labels (text) and the targets, then run again.'));
            return;
        }
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || typeof sel.length !== 'number' || sel.length === 0) {
            alert(L('Rien n\u2019est sélectionné.\nSélectionnez les étiquettes (objets texte) et leurs cibles : points d\u2019ancrage (outil Sélection directe), petits repères, ou traits déjà tracés depuis les étiquettes.',
                'Nothing is selected.\nSelect the labels (text objects) and their targets: anchor points (Direct Selection), small markers, or lines already drawn from the labels.'));
            return;
        }
        var col = collect(doc);
        if (!col.labels.length) {
            alert(L('Aucune étiquette : sélectionnez au moins un objet texte (non groupé).', 'No label: select at least one (ungrouped) text object.'));
            return;
        }
        if (!col.targets.length && !col.leaders.length) {
            alert(L('Aucune cible : sélectionnez aussi des points d\u2019ancrage, des repères ou des traits reliés aux étiquettes.',
                'No target: also select anchor points, markers or lines attached to the labels.'));
            return;
        }
        var o = dialog(doc, col, loadPrefs());
        if (!o) return;
        savePrefs(o);
        var pl = plan(col, o);
        if (!pl.res.length) {
            alert(L('Aucune paire étiquette ↔ cible trouvée.', 'No label ↔ target pair found.'));
            return;
        }
        for (var i = 0; i < pl.res.length; i++) {
            var lay = col.labels[pl.res[i].label].item.layer;
            if (lay.locked || !lay.visible) { alert(L('Le calque des étiquettes est verrouillé ou masqué.', 'The labels\u2019 layer is locked or hidden.')); return; }
        }
        var out = apply(doc, col, pl, o);
        app.redraw();
        alert(L('Terminé.\n', 'Done.\n') + out.lines + L(' trait(s) tracé(s), ', ' leader(s) drawn, ') + out.moved +
            L(' étiquette(s) déplacée(s), ', ' label(s) moved, ') + out.removed + L(' ancien(s) trait(s) remplacé(s).\n', ' old leader(s) replaced.\n') +
            L('Croisements : ', 'Crossings: ') + pl.stats.crossings + '\n' + L('Annulable avec Édition > Annuler.', 'Undo with Edit > Undo.'));
    }

    return { main: main, collect: collect, plan: plan, apply: apply, report: report, DEFAULTS: DEFAULTS, MODES: MODES };
})();

if (typeof app !== 'undefined' && !(typeof $ !== 'undefined' && $.global && $.global.LSC_NO_MAIN)) {
    try { LSC_UI.main(); } catch (err) { alert('LegendesSansCroisement : ' + err + (err.line ? ' (ligne ' + err.line + ')' : '')); }
}
