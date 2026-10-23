// The upper floor is a VIEW of the building page, not a copy: this loader reads ../building/index.html as it is now
// (so every later fix to it is picked up), adds the upper-floor patch (upper_view.js) at a few anchors, and runs it
// with <base href="../building/"> so every asset, panorama and room path resolves exactly as on the building page.
(async () => {
  const msg = t => { const e = document.getElementById('bootmsg'); if (e) e.innerHTML = t; };
  const fail = t => msg(t + '<br><br><a href="../building/index.html">open the full building page instead</a>');
  try {
    const [page, patch] = await Promise.all([
      fetch('../building/index.html', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('building page HTTP ' + r.status); return r.text(); }),
      fetch('./upper_view.js', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('upper_view.js HTTP ' + r.status); return r.text(); })]);
    // patch sections: "//@@ <name>" headers in upper_view.js
    const part = {}; let cur = null;
    for (const line of patch.replace(/\r\n/g, '\n').split('\n')) { const m = line.match(/^\/\/@@ (\w+)/); if (m) { cur = m[1]; part[cur] = ''; } else if (cur) part[cur] += line + '\n'; }
    let html = page.replace(/\r\n/g, '\n');
    const missing = [];
    const put = (anchor, text, where) => {           // where: 'before' | 'after' | 'replace'
      const i = html.indexOf(anchor);
      if (i < 0 || html.indexOf(anchor, i + 1) >= 0) { missing.push(anchor.slice(0, 60)); return; }
      html = where === 'before' ? html.slice(0, i) + text + html.slice(i)
           : where === 'after' ? html.slice(0, i + anchor.length) + text + html.slice(i + anchor.length)
           : html.slice(0, i) + text + html.slice(i + anchor.length);
    };
    put('<head>', '\n<base href="../building/">', 'after');
    put('<title>Hub Building Walkthrough</title>', '<title>Upper Floor Walkthrough</title>', 'replace');
    put('</style>', part.css, 'before');
    put('<body>', '\n<script>document.body.classList.add("upper");</script>', 'after');
    put('Loading the building&hellip;', 'Loading the upper floor&hellip;', 'replace');
    put('const T0 = performance.now();', '\n' + part.head, 'after');
    put("sh.uniforms.zones = ZONES;", 'sh.uniforms.upGrey = UPGREY; ', 'before');
    put("'#include <common>\\nvarying vec3 vWP; uniform vec4 zones[16];", "'#include <common>\\nuniform float upGrey;\\nvarying vec3 vWP; uniform vec4 zones[16];", 'replace');
    put("sh.fragmentShader = sh.fragmentShader.replace('#include <common>'", "sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', UPGREY_GLSL).replace('#include <common>'", 'replace');
    put('refreshList();\n// start in the entrance hall', part.list, 'before');
    put('place(0.1, -2.4, 0, 0.1, 4.0);', 'if (UPV.full) place(0.1, -2.4, 0, 0.1, 4.0); else upvStart();', 'replace');
    put('while ((roomsPending() || !PANO.ready) && !skipped)', 'while ((UPV.full ? (roomsPending() || !PANO.ready) : !upvStartReady()) && !skipped)', 'replace');
    put('preload().catch(', part.tours, 'before');
    put('// ---- test hooks ----', part.tail, 'before');
    if (missing.length) { console.error('upper view: building page anchors not found', missing);
      return fail('The building page changed and the upper-floor view could not attach to it (' + missing.length + ' anchor(s) missing).'); }
    msg('starting');
    document.open(); document.write(html); document.close();
  } catch (e) { console.error(e); fail('Could not load: ' + (e.message || e)); }
})();
