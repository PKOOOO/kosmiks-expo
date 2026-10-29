/**
 * Shared pieces for the Mapbox pages rendered inside WebViews (main map,
 * salon-list mini map, address picker). Each is plain HTML/JS text that gets
 * pasted into a page — no imports run inside the WebView.
 *
 * Mapbox GL JS v3 + the Standard style need WebGL2; without it the pages fall
 * back to v2 + streets-v12 so a map always renders.
 */

export const MAPBOX_GL_V3 = '3.32.0';
export const MAPBOX_GL_V2_FALLBACK = '2.15.0';

/**
 * Defines (in the page): `gl2`, `use3d`, `MAPBOX_VERSION`, `MAPBOX_STYLE`,
 * `lightPreset()` and `loadMapbox(callback)`, which loads the right GL JS
 * build and calls back once `mapboxgl` exists.
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
`;

/** The arch with the petal K, white on the brown pin head (SVG markup). */
export const ARCH_ICON_SVG =
  '<svg width="17" height="22" viewBox="48 40 104 132" aria-hidden="true">' +
  '<path d="M48 168 Q48 172 52 172 H148 Q152 172 152 168 V92 A52 52 0 0 0 48 92 Z" fill="#FFFFFF"/>' +
  '<g transform="translate(28 47) scale(0.7)" fill="#423120">' +
  '<rect x="66" y="50" width="14" height="100" rx="7"/>' +
  '<path d="M88 100 C 96 72 114 56 140 50 C 134 76 116 94 88 100 Z"/>' +
  '<path d="M88 100 C 116 106 134 124 140 150 C 114 144 96 128 88 100 Z"/>' +
  '</g></svg>';

/** CSS for the Kosmiks salon pin: name pill, round brown head, tip. */
export const KOSMIKS_PIN_CSS = `
  .kpin { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
  .kpin-label {
    background: #FFFFFF;
    color: #423120;
    font-family: 'Philosopher', Georgia, serif;
    font-weight: 700;
    font-size: 13px;
    padding: 4px 10px;
    border-radius: 12px;
    margin-bottom: 4px;
    white-space: nowrap;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 6px rgba(66, 49, 32, 0.25);
  }
  .kpin-head {
    position: relative;
    width: 40px; height: 40px;
    border-radius: 50%;
    background: #423120;
    border: 3px solid #FFFFFF;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.25s ease;
  }
  .kpin-tip {
    width: 0; height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 9px solid #FFFFFF;
    margin-top: -2px;
  }
  .kpin.selected .kpin-head { transform: scale(1.22); }
  .kpin.selected .kpin-label { background: #423120; color: #FFFFFF; }
  .kpin.selected .kpin-head::after {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 3px solid #D7C3A7;
    animation: kpulse 1.8s ease-out infinite;
  }
  @keyframes kpulse {
    0% { transform: scale(0.85); opacity: 0.9; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  /* Small variant without the name pill (mini maps). */
  .kpin.small .kpin-head { width: 30px; height: 30px; border-width: 2px; }
  .kpin.small .kpin-head svg { width: 13px; height: 17px; }
`;

/**
 * Defines `makeKosmiksPin(name, small)` in the page: returns the pin element
 * (pass `small` for a compact pin without the name pill).
 */
export const KOSMIKS_PIN_JS = `
  var ARCH_ICON = ${JSON.stringify(ARCH_ICON_SVG)};
  function makeKosmiksPin(name, small) {
    var pin = document.createElement('div');
    pin.className = small ? 'kpin small' : 'kpin';
    if (!small) {
      var label = document.createElement('div');
      label.className = 'kpin-label';
      label.textContent = name;
      pin.appendChild(label);
    }
    var head = document.createElement('div');
    head.className = 'kpin-head';
    head.innerHTML = ARCH_ICON;
    var tip = document.createElement('div');
    tip.className = 'kpin-tip';
    pin.appendChild(head);
    pin.appendChild(tip);
    return pin;
  }
`;
