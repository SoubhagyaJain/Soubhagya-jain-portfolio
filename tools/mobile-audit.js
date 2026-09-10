/* Mobile layout audit, run in the page. Reports the four things the brief cares about:
 * horizontal overflow, text-on-text collisions, decorative layers escaping their
 * clipping ancestor, and the tap-target / type-size floors.
 *
 * Collision detection deliberately looks only at IN-FLOW text leaves. Absolutely
 * positioned layering is intentional throughout this design (glass pills, scrims,
 * masked washes); flagging it would bury the real defects in false positives.
 */
window.__audit = function () {
  const vw = innerWidth;
  const root = document.getElementById('dc-root');
  const compOf = (el) => {
    const h = el.closest('[data-dc-component]');
    return h ? h.getAttribute('data-dc-component') : '?';
  };

  // ── 1. horizontal overflow ────────────────────────────────────────────────
  const wide = [...root.querySelectorAll('*')].filter((e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 1) return false;
    return r.right > vw + 1 || r.left < -1;
  }).filter((e) => {
    // only count it if no ancestor clips it
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflow;
      if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return false;
    }
    return true;
  });

  // ── 2. text-on-text collisions among in-flow leaves ───────────────────────
  const leaves = [...root.querySelectorAll('*')].filter((e) => {
    if (e.children.length) return false;
    if ((e.textContent || '').trim().length < 3) return false;
    const cs = getComputedStyle(e);
    if (cs.position === 'absolute' || cs.position === 'fixed') return false;
    // a fixed overlay crossing scrolling content is the point of a floating navbar,
    // not a defect; skip anything living inside one
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === 'fixed') return false;
    }
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    // opacity does not inherit into getComputedStyle: a leaf inside a panel faded to
    // zero still reports 1. Several chapters reveal panels at disjoint scroll ranges,
    // so effective visibility has to be the product up the ancestor chain.
    let eff = 1;
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      eff *= parseFloat(getComputedStyle(n).opacity);
      if (eff < 0.05) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }).map((e) => ({ e, r: e.getBoundingClientRect(), t: (e.textContent || '').trim().slice(0, 34) }));

  const collisions = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      // cheap reject on the union boxes first
      if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) <= 2) continue;
      if (Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) <= 2) continue;
      // then compare LINE boxes: an inline element that wraps has a union box spanning
      // the full column, which overlaps its neighbours without the text ever colliding
      let hit = null;
      for (const ra of a.e.getClientRects()) {
        for (const rb of b.e.getClientRects()) {
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 2 && oy > 2) {
            const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
            if ((ox * oy) / smaller >= 0.2) hit = Math.round(ox) + 'x' + Math.round(oy);
          }
        }
      }
      if (!hit) continue;
      collisions.push({ where: compOf(a.e), a: a.t, b: b.t, overlap: hit });
    }
  }

  // ── 3. decorative layers escaping a clipping ancestor ─────────────────────
  const escapes = [];
  root.querySelectorAll('*').forEach((e) => {
    const cs = getComputedStyle(e);
    if (cs.position !== 'absolute') return;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    let clip = null;
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflow;
      if (o === 'hidden' || o === 'clip') { clip = n; break; }
    }
    if (!clip) {
      const host = e.closest('[data-dc-component]');
      if (host) {
        const hr = host.getBoundingClientRect();
        if (r.top < hr.top - 2 || r.bottom > hr.bottom + 2) {
          escapes.push({ where: compOf(e), tag: e.tagName, bleedPx: Math.round(Math.max(hr.top - r.top, r.bottom - hr.bottom)) });
        }
      }
    }
  });

  // ── 4. floors ─────────────────────────────────────────────────────────────
  const taps = [...root.querySelectorAll('a,button,input,textarea,[role="button"]')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.height > 0 && (r.height < 44 || r.width < 44);
  });
  const small = [...root.querySelectorAll('*')].filter((e) => {
    if (e.children.length) return false;
    if ((e.textContent || '').trim().length < 3) return false;
    return parseFloat(getComputedStyle(e).fontSize) < 12;
  });

  const zs = {};
  root.querySelectorAll('*').forEach((e) => {
    const z = getComputedStyle(e).zIndex;
    if (z !== 'auto') zs[z] = (zs[z] || 0) + 1;
  });

  return {
    viewport: vw + 'x' + innerHeight,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalScroll: document.body.scrollWidth > vw,
    unclippedOverflow: wide.length,
    textCollisions: collisions.length,
    collisionSample: collisions.slice(0, 8),
    decorativeEscapes: escapes.length,
    escapeSample: escapes.slice(0, 6),
    tapTargetsUnder44: taps.length,
    textUnder12px: small.length,
    zIndexValuesInUse: zs
  };
};
'audit installed';
