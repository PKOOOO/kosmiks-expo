/**
 * Shared pieces for the Mapbox pages rendered inside WebViews (main map,
 * salon-list mini map, address picker). Each is plain HTML/JS text that gets
 * pasted into a page — no imports run inside the WebView.
 *
 * Mapbox GL JS v3 + the Standard style need WebGL2; without it the pages fall
 * back to v2 + streets-v12 so a map always renders.
 */

// Pinned to 3.20.0: from 3.21.0 the map freezes / runs out of memory on load in
// Android Chrome and System WebView (mapbox-gl-js issue #13655, still open
// Nov 2026). On 3.32.0 our Android phones never drew the 3D map. Re-test
// Android before raising this.
export const MAPBOX_GL_V3 = '3.20.0';
export const MAPBOX_GL_V2_FALLBACK = '2.15.0';

/**
 * Defines (in the page): `gl2`, `use3d`, `MAPBOX_VERSION`, `MAPBOX_STYLE`,
 * `lightPreset()`, `loadMapbox(callback)`, which loads the right GL JS
 * build and calls back once `mapboxgl` exists, and `watchMap(map, restart)`,
 * the flat-map fallback for phones that can't draw the 3D map.
 */
export const MAPBOX_LOADER_JS = `
  // Mapbox GL JS v3 requires WebGL2.
  var gl2 = (function () {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
  })();
  // 3D buildings are heavy: keep maps flat on weaker phones. iOS caps
  // hardwareConcurrency (privacy), so every iPhone would look weak; any iPhone
  // with WebGL2 handles 3D, so only Android is judged by its core count.
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var use3d = gl2 && (isIOS || (navigator.hardwareConcurrency || 8) > 4);
  var MAPBOX_VERSION = gl2 ? '${MAPBOX_GL_V3}' : '${MAPBOX_GL_V2_FALLBACK}';
  var MAPBOX_STYLE = gl2 ? 'mapbox://styles/mapbox/standard' : 'mapbox://styles/mapbox/streets-v12';

  // Light follows the device clock.
  function lightPreset() {
    var h = new Date().getHours();
    if (h < 5 || h >= 21) return 'night';
    if (h < 8) return 'dawn';
    if (h < 17) return 'day';
    return 'dusk';
  }

  function loadMapbox(callback) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v' + MAPBOX_VERSION + '/mapbox-gl.css';
    document.head.appendChild(css);
    var script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v' + MAPBOX_VERSION + '/mapbox-gl.js';
    script.onload = callback;
    document.head.appendChild(script);
  }

  // Some Android WebViews report WebGL2 but can't draw the Standard style
  // (the map stays blank behind the pins). If the 3D map can't draw, errors
  // before loading, or loses its WebGL context, switch to the
  // flat v2 + streets-v12 map and run the page's start function again.
  function watchMap(map, restart) {
    if (!gl2) return;
    var loaded = false, failed = false;
    function fail(reason) {
      if (failed) return;
      failed = true;
      try { map.remove(); } catch (e) {}
      gl2 = false;
      use3d = false;
      MAPBOX_VERSION = '${MAPBOX_GL_V2_FALLBACK}';
      MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapFallback', reason: reason }));
      }
      loadMapbox(restart);
    }
    // "drawn" = real pixels reached the canvas. Slower Android phones take
    // well over 15 s to finish loading every 3D tile ('load'), but they draw
    // the map progressively long before that — only a canvas that stays empty
    // means the 3D map is broken (the blank-map phone, Nov 2026).
    var drawn = false, started = Date.now();
    function checkPixels() {
      if (drawn || failed) return;
      try {
        var canvas = map.getCanvas();
        var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return;
        // Sample a 3x3 grid. A plain background colour alone doesn't count:
        // a real map has at least two different colours (roads, buildings…).
        var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), seen = {};
        var colours = 0;
        for (var i = 1; i <= 3; i++) {
          for (var j = 1; j <= 3; j++) {
            gl.readPixels(Math.floor(w * i / 4), Math.floor(h * j / 4), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            if (px[3] === 0) continue;
            var key = px[0] + ',' + px[1] + ',' + px[2];
            if (!seen[key]) { seen[key] = true; colours++; }
          }
        }
        if (colours >= 2) drawn = true;
      } catch (e) {}
      if (drawn) {
        map.off('render', checkPixels);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapDrawn', ms: Date.now() - started }));
        }
      }
    }
    map.on('render', checkPixels);
    map.on('load', function () { loaded = true; });
    map.on('error', function (e) {
      // A single missing tile (sourceId set) isn't worth giving up the 3D map.
      if (!loaded && !drawn && !(e && e.sourceId)) fail('error: ' + ((e && e.error && e.error.message) || 'unknown'));
    });
    map.getCanvas().addEventListener('webglcontextlost', function () { fail('webglcontextlost'); });
    // A slow network only delays the style; once it's here, a phone whose
    // canvas is still empty after 15 s gets the flat map.
    var styleTimer = setTimeout(function () { if (!loaded && !drawn) fail('style timeout'); }, 30000);
    map.once('style.load', function () {
      clearTimeout(styleTimer);
      setTimeout(function () { if (!loaded && !drawn) fail('draw timeout'); }, 15000);
    });
  }
`;

/**
 * CSS for the salon pin, modelled on the client's Lottie reference (Nov 2026):
 * a plain round head with a white dot and a small point underneath — no name
 * pill, no logo. Lottie proportions: dot = 28 % of the head, point ≈ 0.29 ×
 * 0.21 of the head. Kosmiks brown instead of the Lottie's navy.
 */
export const KOSMIKS_PIN_CSS = `
  .kpin {
    position: relative;
    display: flex; flex-direction: column; align-items: center;
    cursor: pointer;
  }
  .kpin-head {
    position: relative;
    width: 34px; height: 34px;
    border-radius: 50%;
    background: #423120;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    transition: transform 0.25s ease;
    transform-origin: 50% 100%;
  }
  .kpin-head::after {
    content: '';
    position: absolute;
    left: 50%; top: 50%;
    width: 28%; height: 28%;
    border-radius: 50%;
    background: #FFFFFF;
    transform: translate(-50%, -50%);
  }
  .kpin-tip {
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid #423120;
    margin-top: -1px;
  }
  .kpin.selected .kpin-head { transform: scale(1.12); }
  /* Selected salon: a translucent "zone" on the ground at the pin's point
     that grows to full size and shrinks back, 1.5 s loop (timing and easing
     from the client's Lottie reference, Nov 2026, recoloured to Kosmiks
     brown). On the 3D map it is squashed so it lies flat under the pin. */
  .kpin-zone {
    --squash: 1;
    position: absolute;
    left: 50%; bottom: 0;
    width: 120px; height: 120px;
    margin-left: -60px; margin-bottom: -60px;
    border-radius: 50%;
    box-sizing: border-box;
    background: rgba(66, 49, 32, 0.15);
    border: 2px solid #423120;
    transform: scaleY(var(--squash)) scale(0);
    pointer-events: none;
    z-index: -1;
    display: none;
  }
  .kpin.tilt .kpin-zone { --squash: 0.55; }
  .kpin.selected .kpin-zone {
    display: block;
    animation: kzone 1.5s cubic-bezier(0.333, 0, 0.667, 1) infinite;
  }
  @keyframes kzone {
    0%   { transform: scaleY(var(--squash)) scale(0); }
    50%  { transform: scaleY(var(--squash)) scale(1); }
    100% { transform: scaleY(var(--squash)) scale(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .kpin.selected .kpin-zone { animation: none; transform: scaleY(var(--squash)) scale(1); }
  }
  /* Small variant (mini maps). */
  .kpin.small .kpin-head { width: 24px; height: 24px; }
  .kpin.small .kpin-tip { border-left-width: 4px; border-right-width: 4px; border-top-width: 5px; }
`;

/**
 * Defines `makeKosmiksPin(name, small)` in the page: returns the pin element.
 * The name is not drawn (the cards show it); it is the pin's accessible label.
 */
export const KOSMIKS_PIN_JS = `
  function makeKosmiksPin(name, small) {
    var pin = document.createElement('div');
    pin.className = small ? 'kpin small' : 'kpin';
    // use3d comes from MAPBOX_LOADER_JS (false on the flat fallback map).
    if (typeof use3d !== 'undefined' && use3d) pin.className += ' tilt';
    if (name) { pin.setAttribute('role', 'button'); pin.setAttribute('aria-label', name); }
    var zone = document.createElement('div');
    zone.className = 'kpin-zone';
    var head = document.createElement('div');
    head.className = 'kpin-head';
    var tip = document.createElement('div');
    tip.className = 'kpin-tip';
    pin.appendChild(zone);
    pin.appendChild(head);
    pin.appendChild(tip);
    return pin;
  }
`;

/**
 * Defines `highlightBuilding(map, lngLat)` in the page: colours the 3D
 * building nearest to a point (feature state `select`, colour from the
 * style's `colorBuildingSelect`) and un-colours the previous one. A pin's
 * coordinate often sits on the pavement next to its building, so it looks
 * within a small radius and takes the building whose centre is nearest.
 * Needs `use3d` (MAPBOX_LOADER_JS); does nothing on flat maps.
 */
export const BUILDING_HIGHLIGHT_JS = `
  var highlightedBuilding = null;
  function footprintCentre(map, feature) {
    var geom = feature.geometry || {};
    var ring = geom.type === 'Polygon' ? geom.coordinates[0]
      : geom.type === 'MultiPolygon' ? geom.coordinates[0][0] : null;
    if (!ring || !ring.length) return null;
    var x = 0, y = 0;
    ring.forEach(function (c) { var pt = map.project(c); x += pt.x; y += pt.y; });
    return { x: x / ring.length, y: y / ring.length };
  }
  function highlightBuilding(map, lngLat) {
    if (!use3d) return;
    try {
      if (highlightedBuilding) { map.setFeatureState(highlightedBuilding, { select: false }); highlightedBuilding = null; }
      if (!lngLat) return;
      var p = map.project(lngLat);
      var r = 45;
      var found = map.queryRenderedFeatures(
        [[p.x - r, p.y - r], [p.x + r, p.y + r]],
        { target: { featuresetId: 'buildings', importId: 'basemap' } }
      ) || [];
      var best = null, bestDistance = Infinity;
      found.forEach(function (feature) {
        var c = footprintCentre(map, feature);
        if (!c) return;
        var d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bestDistance) { best = feature; bestDistance = d; }
      });
      if (best) {
        highlightedBuilding = best;
        map.setFeatureState(highlightedBuilding, { select: true });
      }
    } catch (e) { /* not supported here: the pin is enough */ }
  }
`;
