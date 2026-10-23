// Upper-floor view of the building page. Not a module of its own: ../upper-floor/index.html splices each "//@@ name"
// section into the live ../building/index.html at fixed anchors, so this code runs INSIDE the building page's module
// (same engine, same panoramas, same stairs and corridor fixes, same AgX LUT / colour management).
// Upper mode: the first floor only (ground floor greyed, ground rooms and ground 360 images not loaded), each upper area's
// panoramas loaded when you come near it or pick it. Walking down a stair (eye below 2.6 m) or "Ground floor" switches
// this same page to the full building in place (ground rooms + tours stream in, ground plan minimap, original list).
//@@ css
body.upper #tourbtn{display:none}
#rooms #upgf{display:block;width:100%;margin:0 0 6px;padding:9px 11px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:700;text-align:left;cursor:pointer}
#rooms #upgf small{display:block;color:#fff;font-weight:400;font-size:11.5px;opacity:.9}
#rooms a.upfull{display:block;margin:0 0 10px 2px;font-size:11.5px;color:var(--accent)}
#rooms button.upcur{background:#efebe4}
//@@ head
const UPV = { full: false, panoOK: false, t0: performance.now(), want: new Set(), wantId: null, texBusy: false, extra: [], prog: {} };
const UPGREY = { value: 1 };                        // 1 = ground floor drawn flat grey (upper mode), 0 = normal
// stair wells keep their real colour so the flights read while you walk down them (three coords: z = -Blender Y)
const UPGREY_GLSL = `#include <dithering_fragment>
        if (upGrey > 0.5 && vWP.y < 2.36 && !((vWP.x > 0.55 && vWP.x < 3.90 && vWP.z > -2.05 && vWP.z < -0.15) ||
                                              (vWP.x > 14.30 && vWP.x < 18.80 && vWP.z > -4.95 && vWP.z < -1.50))) {
          float l = dot(gl_FragColor.rgb, vec3(0.30, 0.59, 0.11));
          gl_FragColor.rgb = vec3(0.30, 0.305, 0.31) * (0.55 + 0.45 * clamp(l / 0.8, 0., 1.)); }`;
//@@ list
// ---- UPPER-FLOOR VIEW (../upper-floor/upper_view.js): areas, list, minimap, floor buttons ----
// zone: Blender XY boxes [x0, x1, y0, y1]; the first area whose box holds a node / the walker owns it
const UPA = [
  { k: 'lobby', n: 'Main stairs &amp; lobby', zone: [[-1.80, 0.54, -3.16, 1.24], [0.54, 3.90, 0.17, 2.05]], at: [0.75, 0.75, 2.44], look: [0.75, -3.0], slug: 'stairs', page: '../rooms/stairs/index.html' },
  { k: 'estair', n: 'East stair &middot; Founder Space 1 &harr; 2', zone: [[14.30, 18.80, 1.50, 4.95]], at: [14.5, 2.07, 2.44], look: [17.0, 2.07], slug: 'stairs' },
  { k: 'corr', n: 'Upper corridors &middot; west wing', zone: [[-18.60, -15.40, 1.27, 3.40], [-15.40, -8.50, 0.41, 4.21], [-8.50, -5.32, 1.27, 3.34]], at: [-6.9, 2.3, 2.44], look: [-15.0, 2.3], slug: 'upper_floor', page: '../rooms/upper_floor/index.html' },
  { k: 'cafe', n: 'Cafeteria', zone: [[-5.28, 3.82, 1.24, 7.80]], at: [-0.6, 4.85, 2.44], look: [-5.0, 5.2], slug: 'cafeteria', page: '../rooms/cafeteria/index.html' },
  { k: 'balc', n: 'Balcony', zone: [[-5.65, 4.15, 7.80, 13.60]], at: [-0.8, 9.0, 2.44], look: [-0.8, 13.0], slug: 'balcony', page: '../rooms/balcony/index.html' },
  { k: 'podium2', n: 'Meeting Podium 2', zone: [[4.94, 6.95, -2.42, -0.08]], at: [5.85, 0.60, 2.44], look: [5.85, -1.50], slugs: ['meeting_podium_2'] },   // inside the east wing: listed before it
  { k: 'ufs', n: 'Upper Founder Space &middot; east wing', zone: [[3.90, 18.72, -3.22, 7.78]], at: [5.0, 2.75, 2.44], look: [9.0, 2.75], slug: 'upper_founder_space', page: '../rooms/upper_founder_space/index.html' },
  // areas with no render of their own yet: plain building; picked up by upvDiscover() when a folder appears in /rooms/
  { k: 'kitchen', n: 'Kitchen', zone: [[-8.88, -5.37, 4.21, 7.83]], at: [-7.1, 2.3, 2.44], look: [-7.1, 5.9], slugs: ['kitchen'] },
  { k: 'vip', n: 'VIP Suite', zone: [[-18.80, -15.44, 3.41, 7.83]], at: [-16.9, 2.33, 2.44], look: [-17.15, 4.6], slugs: ['vip_suite', 'vip'] },
  { k: 'teamlead', n: 'Team Lead Office', zone: [[-15.41, -11.90, 4.21, 7.83]], at: [-13.6, 3.71, 2.44], look: [-13.6, 5.3], slugs: ['team_lead_office', 'team_lead'] },
  { k: 'hubpers', n: 'Hub Personnel', zone: [[-11.87, -8.91, 4.21, 7.83]], at: [-10.4, 3.71, 2.44], look: [-10.4, 5.5], slugs: ['hub_personnel', 'hub_personel'] },
  { k: 'board', n: 'Board Room', zone: [[-18.80, -11.90, -3.22, 0.41], [-18.80, -15.40, 0.41, 1.17]], at: [-14.0, 0.88, 2.44], look: [-15.9, -1.3], slugs: ['board_room', 'boardroom'] },
  { k: 'iotech', n: 'IoTech', zone: [[-11.84, -8.91, -3.22, 0.41]], at: [-10.25, 0.88, 2.44], look: [-10.25, -0.9], slugs: ['iotech', 'io_tech'] },
  { k: 'startup', n: 'Startup Space', zone: [[-8.88, -5.37, -3.22, 1.23]], at: [-7.1, 2.3, 2.44], look: [-7.1, 0.2], slugs: ['startup_space', 'startup'] },
  { k: 'ujc', n: 'UJ Connect', zone: [[-5.31, -1.83, -1.46, 1.23]], at: [-0.6, -0.65, 2.44], look: [-3.6, -0.65], slugs: ['uj_connect'] },
  { k: 'ladies1', n: 'Ladies Room (first floor)', zone: [[-5.31, -1.83, -3.22, -1.52]], at: [-0.6, -2.5, 2.44], look: [-4.3, -2.5], slugs: ['washroom_ladies_upper', 'upper_washroom_ladies', 'ladies_room'] },
  { k: 'janitor', n: "Janitor's Room", zone: [[0.54, 3.84, -1.52, 0.17]], at: [-0.6, -0.98, 2.44], look: [2.1, -0.98], slugs: ['janitors_room', 'janitor_room', 'janitor'] },
  { k: 'gents1', n: 'Gents Room (first floor)', zone: [[0.54, 3.84, -3.22, -1.58]], at: [-0.6, -2.6, 2.44], look: [2.1, -2.6], slugs: ['washroom_gents_upper', 'upper_washroom_gents', 'gents_room'] },
];
const upvIn = (zone, x, y) => zone.some(([x0, x1, y0, y1]) => x > x0 && x < x1 && y > y0 && y < y1);
const upvAreaAt = b => (b.z - EYE < 0.9) ? null : UPA.find(a => upvIn(a.zone, b.x, b.y)) || null;
const upvAreaOf = n => { if ((n.floor || 0) < 0.9) return 'g:' + n.tour; const a = UPA.find(q => upvIn(q.zone, n.x, n.y)); return a ? a.k : 'g:' + n.tour; };
const upvNodes = a => UPV.panoOK ? Object.values(PANO.byId).filter(n => (n.floor || 0) >= 0.9 && upvAreaOf(n) === a.k) : [];
function upvStatus(a) {
  const ns = upvNodes(a), R = ns.filter(n => PANO.rendered.has(n.id)), L = R.filter(n => PANO.tex[n.id]);
  if (R.length) return { ok: true, rendered: true, txt: `360 &middot; ${R.length}/${ns.length} views` + (L.length === R.length ? ' &middot; loaded' : L.length ? ' &middot; loading' : '') };
  const done = (UPV.prog[a.slug] || []).join(' ');
  if (/final/.test(done)) return { ok: false, rendered: false, stills: true, txt: 'stills done &middot; 360 not rendered yet' };
  if (/draft/.test(done)) return { ok: false, rendered: false, txt: 'drafts only &middot; not rendered yet' };
  return { ok: false, rendered: false, txt: 'not rendered yet' };
}
function upvList() {
  list.innerHTML = '';
  const g = document.createElement('button'); g.id = 'upgf';
  g.innerHTML = 'Ground floor &darr;<small>down the stair of this wing into the full building</small>'; g.onclick = () => upvGround();
  list.appendChild(g);
  const f = document.createElement('a'); f.className = 'upfull'; f.href = '../building/index.html'; f.textContent = 'open the full building page';
  list.appendChild(f);
  const here = upvAreaAt(T2B(pos));
  for (const a of UPA) {
    const s = upvStatus(a), b = document.createElement('button'); b.dataset.area = a.k;
    if (here && here.k === a.k) b.className = 'upcur';
    b.innerHTML = `<span>${a.n}</span><small class="${s.ok ? 'ok' : 'no'}">${s.txt}</small>`;
    b.onclick = () => upvGo(a.k); list.appendChild(b);
    if (a.page) { const p = document.createElement('a'); p.className = 'walkbtn'; p.textContent = 'standalone page'; p.href = a.page;
      p.style.textDecoration = 'none'; p.style.display = 'inline-block'; list.appendChild(p); }
  }
}
function upvGo(k) {
  const a = UPA.find(q => q.k === k); if (!a) return;
  if (UPV.full) upvBackUp();
  UPV.want.add(k);
  const b = { x: a.at[0], y: a.at[1] };
  const R = upvNodes(a).filter(n => PANO.rendered.has(n.id)).sort((n, m) => Math.hypot(n.x - b.x, n.y - b.y) - Math.hypot(m.x - b.x, m.y - b.y));
  if (R.length && use360.checked) { UPV.wantId = R[0].id; window.__enterPano(R[0].id, true); refreshList(); return; }
  PANO.anim = null; exitPano(); place(a.at[0], a.at[1], a.at[2], a.look[0], a.look[1]); refreshList();   // cancel a running glide first
}
function upvStart() { const a = UPA[0]; place(a.at[0], a.at[1], a.at[2], a.look[0], a.look[1]); }
function upvStartReady() {
  if (!UPV.panoOK) return false;
  if (performance.now() - UPV.t0 > 8000) return true;
  const b = T2B(pos), n = nearestNode(b);
  return !n || Math.hypot(n.x - b.x, n.y - b.y) > 3.0 || !!PANO.tex[n.id];
}
// the whole building, in place: ground rooms queue (nearest first), the ground tours join, original list + minimap
function enableFull() {
  if (UPV.full) return;
  UPV.full = true; UPGREY.value = 0; document.body.classList.remove('upper');
  document.querySelector('#rooms h3').innerHTML = UPV.h3; use360.parentNode.lastChild.nodeValue = UPV.lbl; document.getElementById('note').innerHTML = UPV.note;
  if (UPV.panoOK) upvGroundTours(); else UPV.groundPending = true;
  refreshList(); lazyTick();
}
// back up from the full page (list pick while in full mode): stay full, nothing is unloaded
function upvBackUp() {}
// "Ground floor": down the stair of the wing you are in, as on the plans. East wing (Upper Founder Space): the U-shaped east stair
// E3 -> landing 1.58 -> E2 -> landing 0.94 -> E1 into Founder Space 1 (4 s). Elsewhere: the main stair W2 -> landing 1.60
// -> W1 into the Reception (2.4 s)
function upvGround() {
  use360.checked = true; PANO.anim = null; exitPano(); PANO.mode = false; PANO.alpha = PANO.target = 0;
  const east = T2B(pos).x > 3.90;                       // the whole east wing (Upper Founder Space) uses the east stair
  enableFull();
  const path = east ? [[14.6, 2.07, 2.44], [15.6, 2.07, 2.44], [17.6, 2.07, 1.58], [18.3, 2.07, 1.58], [18.3, 2.50, 1.58], [18.3, 4.05, 0.94],
                       [18.3, 4.27, 0.94], [17.4, 4.27, 0.94], [15.0, 4.27, 0.0], [14.4, 4.27, 0.0]]
                    : [[1.10, 0.78, 2.44], [3.45, 0.78, 1.60], [3.45, 1.60, 1.60], [1.15, 1.60, 0.20], [0.30, 1.60, 0.0]];
  pos.copy(B2T(path[0][0], path[0][1], path[0][2] + EYE));
  STAIR.anim = { t: 0, dur: east ? 4.0 : 2.4, path: stairPath(path), endYaw: east ? Math.PI / 2 : 0, dir: 'down' };
}
const _refreshList = refreshList, _lazyTick = lazyTick, _drawMini = drawMini, _upMini = upMini, _goFloor = goFloor;
refreshList = function () { if (UPV.full) return _refreshList(); upvList(); };
lazyTick = function () { if (UPV.full) return _lazyTick(); };            // upper mode: no ground-floor rooms
goFloor = function (k) { if (UPV.full) return _goFloor(k); if (k === 0) return upvGround(); exitPano(); upvStart(); };
upMini = function () {
  if (UPV.full) return _upMini();
  document.getElementById('fl0').classList.remove('on'); document.getElementById('fl1').classList.add('on');
};
// minimap: the first floor only, every area outlined (green = 360 rendered, amber = stills only, grey = not rendered)
drawMini = function () {
  if (UPV.full || !plan1Ready) return _drawMini();
  Object.assign(VIEW, VIEW_UP);
  const PL = PLAN1, pp = (bx, by) => ({ x: PL.x0 + (bx - PL.mx0) / PL.sx, y: PL.y0 + (PL.my0 - by) / PL.sy });
  const a = pp(VIEW.bx0, VIEW.by1), c = pp(VIEW.bx1, VIEW.by0);
  mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, mini.width, mini.height);
  mctx.drawImage(planImg1, a.x, a.y, c.x - a.x, c.y - a.y, 0, 0, mini.width, mini.height);
  const bp = T2B(pos), here = upvAreaAt(bp);
  for (const A of UPA) {
    const s = upvStatus(A);
    mctx.strokeStyle = s.rendered ? 'rgba(63,125,90,.95)' : s.stills ? 'rgba(160,99,42,.85)' : 'rgba(120,120,120,.6)';
    mctx.lineWidth = here && here.k === A.k ? 2.6 : s.rendered ? 1.8 : 1.1; mctx.setLineDash(s.rendered ? [] : [4, 3]);
    for (const [x0, x1, y0, y1] of A.zone) { const p0 = m2p(x0, y1), p1 = m2p(x1, y0); mctx.strokeRect(p0.px, p0.py, p1.px - p0.px, p1.py - p0.py); }
  }
  mctx.setLineDash([3, 2]); mctx.strokeStyle = 'rgba(45,108,223,.75)'; mctx.lineWidth = 1.2;
  for (const [x0, x1, y0, y1] of UP_VOIDS) { const p0 = m2p(x0, y1), p1 = m2p(x1, y0); mctx.strokeRect(p0.px, p0.py, p1.px - p0.px, p1.py - p0.py); }
  mctx.setLineDash([]); mctx.fillStyle = 'rgba(157,95,63,.55)';
  for (const [x0, x1, y0, y1] of UP_FLIGHTS) { const p0 = m2p(x0, y1), p1 = m2p(x1, y0); mctx.fillRect(p0.px, p0.py, p1.px - p0.px, p1.py - p0.py); }
  if (UPV.panoOK) for (const n of Object.values(PANO.byId)) {
    if ((n.floor || 0) < 0.9 || upvAreaOf(n).startsWith('g:')) continue;
    const q = m2p(n.x, n.y), on = PANO.rendered.has(n.id), cur = n.id === PANO.cur && PANO.mode;
    mctx.beginPath(); mctx.arc(q.px, q.py, cur ? 3.6 : 2.6, 0, 7);
    mctx.fillStyle = on ? (cur ? '#9d5f3f' : 'rgba(63,125,90,.95)') : '#bdb9b3'; mctx.fill();
  }
  { const cap = document.querySelector('#mini .cap'), t = 'first floor plan &middot; click to teleport &middot; green = 360 rendered, dashed = not yet';
    if (cap.dataset.t !== t) { cap.innerHTML = t; cap.dataset.t = t; } }
  const p = m2p(bp.x, bp.y), fx = -Math.sin(yaw), fy = Math.cos(yaw);
  mctx.strokeStyle = '#9d5f3f'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(p.px, p.py); mctx.lineTo(p.px + fx * 14, p.py - fy * 14); mctx.stroke();
  mctx.fillStyle = '#2d6cdf'; mctx.beginPath(); mctx.arc(p.px, p.py, 4.5, 0, 7); mctx.fill();
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.4; mctx.stroke();
};
//@@ tours
// ---- UPPER-FLOOR VIEW: tours. Upper mode reads the Cafeteria + Balcony tours (+ the stairs / corridors / Upper Founder
// Space tours via upLoad); panorama IMAGES load per area, when you come near the area or pick it ----
// every tour's node GRAPH is read at once (small JSON files, building-page order, so the Cafeteria's ids win where the
// Corridor's c00..c06 collide, as there): the stairs connect the floors in 360 too (landing s00 <-> Reception p09).
// Images of the ground tours load only when you come near them (the stair neighbours first).
UPV.groundTours = []; UPV.groundDone = true;
function upvLink(metas) {
  for (const m of metas) for (const [a, c] of (m.links || [])) {
    const A = PANO.byId[a], C = PANO.byId[c]; if (!A || !C) continue;
    if (!A.neighbours.includes(c)) A.neighbours.push(c);
    if (!C.neighbours.includes(a)) C.neighbours.push(a);
  }
}
preload = async function () {
  const metas = [];
  for (const T of TOURS) { try { metas.push(await loadTour(T)); } catch (e) { console.warn('tour not available', T.key, e); } }
  upvLink(metas);
  PANO.ready = true; UPV.panoOK = true; UPV.metas = metas;
  if (UPV.groundPending) upvGroundTours();
  refreshList();
  setInterval(pollTours, 20000);
};
// ground tours join when the walker goes down (same order as the building page: the Cafeteria's ids win where the
// Corridor's c00..c06 collide, exactly as there)
async function upvGroundTours() {
  if (UPV.groundDone) return; UPV.groundDone = true;
  const metas = [];
  for (const T of UPV.groundTours) { try { metas.push(await loadTour(T)); TOURS.push(T); } catch (e) { console.warn('tour not available', T.key, e); } }
  for (const n of PANO.nodes) if (n.tour === 'cafeteria' || n.tour === 'balcony') PANO.byId[n.id] = n;
  for (const n of UPN) PANO.byId[n.id] = n;
  upvLink([...metas, ...(UPV.metas || [])]);
  if (PANO.mode && !PANO.anim) layoutRings();
}
// polling: new panoramas join the graph; a re-render replaces an image only if that image is already loaded
async function upvPollList(T) {
  const { list, ver } = await readList({ ...T, poll: true }); if (!list) return;
  for (const id of list) {
    const n = PANO.byId[id]; if (!n || n.tour !== T.key) continue;
    const nv = ver && ver[id];
    if (!PANO.rendered.has(id)) { PANO.rendered.add(id); if (nv) PANO.ver[id] = nv; }
    else if (nv && nv !== PANO.ver[id]) { PANO.ver[id] = nv; if (PANO.tex[id]) await loadTex(id); }
  }
}
pollTours = async function () {
  for (const T of TOURS) if (T.poll) await upvPollList(T);
  if (PANO.mode && !PANO.anim) layoutRings();
};
upPoll = async function () {
  for (const T of [...UP_TOURS, ...UPV.extra]) await upvPollList(T);
  if (PANO.mode && !PANO.anim) layoutRings();
  if (!UPV.full) refreshList();
};
// per-area image loading, one image at a time, nearest first: the area you are in, areas with a node within 9 m on
// your floor, areas picked from the list, and the neighbours of the panorama you are in
async function upvTexPump() {
  if (UPV.texBusy || !UPV.panoOK) return;
  const b = T2B(pos), feet = Math.max(0, b.z - EYE), near = new Set(UPV.want), here = upvAreaAt(b);
  if (here) near.add(here.k);
  for (const id of PANO.rendered) { const n = PANO.byId[id];
    if (n && Math.abs((n.floor || 0) - feet) < 1.0 && Math.hypot(n.x - b.x, n.y - b.y) < 9.0) near.add(upvAreaOf(n)); }
  const nb = new Set(PANO.mode && PANO.byId[PANO.cur] ? PANO.byId[PANO.cur].neighbours : []);
  const c = [...PANO.rendered].filter(id => { const n = PANO.byId[id];
    return n && !PANO.tex[id] && (id === UPV.wantId || id === PANO.cur || nb.has(id) || near.has(upvAreaOf(n))); });
  if (!c.length) return;
  const pri = id => id === UPV.wantId || id === PANO.cur ? -1e3 : nb.has(id) ? -500 : 0;
  c.sort((i, j) => pri(i) - pri(j) + Math.hypot(PANO.byId[i].x - b.x, PANO.byId[i].y - b.y) - Math.hypot(PANO.byId[j].x - b.x, PANO.byId[j].y - b.y));
  UPV.texBusy = true;
  try { await loadTex(c[0]); } finally { UPV.texBusy = false; }
  if (!UPV.full) refreshList();
}
// auto-entry (walking, 360 on) on the first floor: only a panorama of the area you are in, within 2.6 m, already loaded
// (never a glide across the floor to the nearest rendered node of another area)
const _enterPanoUV = enterPano;
enterPano = function (id, fromList) {
  if (!id && !fromList) {
    const b = T2B(pos);
    if (b.z > 3.0) {
      const n = nearestNode(b), here = upvAreaAt(b);
      if (!n || !PANO.tex[n.id] || Math.hypot(n.x - b.x, n.y - b.y) > 2.6 || Math.abs((n.floor || 0) - (b.z - EYE)) > 0.5) return;
      if (here && upvAreaOf(n) !== here.k) return;
    }
  }
  return _enterPanoUV(id, fromList);
};
//@@ tail
// ---- UPPER-FLOOR VIEW: page text, discovery of newly rendered areas, the walk-down switch, test hooks ----
UPV.h3 = document.querySelector('#rooms h3').innerHTML; UPV.lbl = use360.parentNode.lastChild.nodeValue; UPV.note = document.getElementById('note').innerHTML;
document.querySelector('#rooms h3').innerHTML = 'Upper floor &middot; areas';
use360.parentNode.lastChild.nodeValue = ' Use 360 tours (upper floor areas)';
document.getElementById('note').innerHTML = '<b>Upper floor.</b> Ground floor greyed. Each area\'s 360 panoramas load when you come near it or pick it; '
  + 'areas not rendered yet are the plain building. Walk down the main stairs (or press Ground floor) for the full building.';
// stills / drafts status of the rendered areas, and new area folders in /rooms/ (directory listing: no 404s)
async function upvDiscover() {
  for (const s of new Set(UPA.map(a => a.slug).filter(Boolean))) {
    try { const r = await fetch('../rooms/' + s + '/progress.json', { cache: 'no-store' }); if (r.ok) UPV.prog[s] = (await r.json()).done || []; } catch (e) {}
  }
  let dirs = null;
  try { const r = await fetch('../rooms/', { cache: 'no-store' }); if (r.ok) dirs = new Set([...(await r.text()).matchAll(/href="([^"/?]+)\/"/g)].map(m => decodeURIComponent(m[1]))); } catch (e) {}
  if (dirs) for (const a of UPA) {
    if (a.slug || !a.slugs) continue;
    const s = a.slugs.find(q => dirs.has(q)); if (!s) continue;
    let files = '';
    try { const r = await fetch('../rooms/' + s + '/', { cache: 'no-store' }); if (r.ok) files = await r.text(); } catch (e) {}
    if (/href="progress\.json"/.test(files)) a.slug = s;
    if (/href="index\.html"/.test(files)) a.page = '../rooms/' + s + '/index.html';
    if (Object.values(PANO.byId).some(n => n.tour === s) || TOURS.find(q => q.key === s)) continue;   // already read (building page block)
    if (/href="tour\/"/.test(files)) {
      let tf = ''; try { const r = await fetch('../rooms/' + s + '/tour/', { cache: 'no-store' }); if (r.ok) tf = await r.text(); } catch (e) {}
      if (/href="nodes\.json"/.test(tf) && /href="rendered\.json"/.test(tf)) {
        try { const T = { key: s, base: '../rooms/' + s + '/tour/', name: a.n.replace(/&[a-z]+;/g, ''), needList: true, poll: false };
          const d = await (await fetch(T.base + 'nodes.json', { cache: 'no-store' })).json();
          for (const n of d.nodes) { n.base = T.base; n.tour = T.key; n.neighbours = [...n.neighbours]; UPN.push(n); PANO.byId[n.id] = n; }
          upvLink([d.meta || {}]); UPV.extra.push(T); TOURS.push(T); a.slug = a.slug || s; } catch (e) { console.warn('area tour not readable yet', s); }
      }
    }
  }
  if (UPV.panoOK) await upPoll();
  if (!UPV.full) refreshList();
}
upvDiscover(); setInterval(upvDiscover, 30000);
setInterval(upvTexPump, 250);
// walking down either stair (eye below 2.6 m) = the full building, in place
setInterval(() => { if (!UPV.full && T2B(pos).z < 2.6) enableFull(); }, 100);
// list highlight follows the walker's area
let upvLastArea = null;
setInterval(() => { if (UPV.full) return; const a = upvAreaAt(T2B(pos)), k = a ? a.k : null; if (k !== upvLastArea) { upvLastArea = k; refreshList(); } }, 400);
window.__upv = {
  full: () => UPV.full, panoOK: () => UPV.panoOK, ready: () => upvStartReady(),
  areas: () => UPA.map(a => { const s = upvStatus(a); return { k: a.k, n: a.n.replace(/&[a-z]+;/g, ' '), rendered: s.rendered, status: s.txt.replace(/&[a-z]+;/g, '·') }; }),
  area: () => { const a = upvAreaAt(T2B(pos)); return a ? a.k : null; },
  go: k => { upvGo(k); return T2B(pos); }, ground: () => upvGround(), start: () => { upvStart(); return T2B(pos); },
  tex: () => Object.keys(PANO.tex), grey: () => UPGREY.value, tours: () => TOURS.map(T => T.key),
};
