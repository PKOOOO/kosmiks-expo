import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { WebView } from '@/components/WebView';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_TOKEN, hasMapboxToken, MAP_UNAVAILABLE_HTML } from '@/config/constants';
import { MAPBOX_LOADER_JS, BUILDING_HIGHLIGHT_JS } from '@/lib/map-html';
import { forwardGeocode, reverseGeocode as lookupAddress } from '@/lib/geocode';


// Helsinki — default center when we have no coordinates or address yet.
const DEFAULT_LAT = 60.1699;
const DEFAULT_LNG = 24.9384;

const darkBrown = '#423120';
const beige = '#D7C3A7';
const white = '#FFFFFF';

// Keep the floating pin label Glovo-sized. Full reverse-geocoded addresses can
// be several words wide, so prefer the useful trailing location hierarchy:
// postal code, city/county, country. Addresses without a postal code fall back
// to the final city/country pair.
const compactMarkerLabel = (value: string) => {
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const possibleCode = parts.at(-3) ?? '';
    const isPostalOrPlusCode = /^(?=.*\d)[a-z\d][a-z\d+ -]{2,11}$/i.test(possibleCode);
    return parts.slice(isPostalOrPlusCode ? -3 : -2).join(', ');
  }
  return value.trim();
};

type Props = {
  initialAddress?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (data: { address: string; latitude: number; longitude: number }) => void;
  showSearch?: boolean;
  showResolvedAddress?: boolean;
  searchLeft?: number;
  markerVariant?: 'default' | 'location';
  markerLabel?: string;
  markerSubtitle?: string;
  markerIcon?: 'globe' | 'home';
  showMarkerLabel?: boolean;
  onMarkerPress?: () => void;
  onPinDrop?: () => void;
};

// Pin icons for the 'location' marker variant.
const PIN_ICON_HOME = '<path d="M19 29L32 18L45 29V44H36V34H28V44H19V29Z" fill="none" stroke="#171411" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
const PIN_ICON_GLOBE = '<path d="M14 31H50M32 13C25 19 22 25 22 31C22 38 25 44 32 49M32 13C39 19 42 25 42 31C42 38 39 44 32 49" fill="none" stroke="#171411" stroke-width="3" stroke-linecap="round"/>';

// Build the Mapbox HTML once. The marker is draggable and the map is tappable;
// both post the new {lat,lng} back to React Native. `window.setMarker` lets RN
// move the marker after a text search resolves to coordinates.
//
// Same engine, style and 3D view as the main map (src/lib/map-html.ts): the
// building under the pin is highlighted so providers can see which building
// they picked. The pin is an HTML marker, so 3D buildings never cover it. The
// window.* functions exist before the map has loaded (RN calls them on mount);
// early calls are applied once it is ready.
const buildHTML = (
  lat: number,
  lng: number,
  markerVariant: 'default' | 'location',
  markerLabel: string,
  markerSubtitle: string,
  markerIcon: 'globe' | 'home',
  showMarkerLabel: boolean,
  hasLocation: boolean,
) => {
  // Building level when we know where the salon is; city level otherwise.
  const initialZoom = hasLocation ? 16 : 13;

  // No token: show a static notice rather than a map whose accessToken
  // would be the literal string 'undefined'. hasMapboxToken() logs once.
  if (!hasMapboxToken()) return MAP_UNAVAILABLE_HTML;

  const locationMarkerHTML = `
    <div class="salon-marker-label" style="display:${showMarkerLabel && markerLabel ? 'flex' : 'none'}">
      <span class="salon-marker-label-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 3L10.2 13.8M21 3L14.2 21L10.2 13.8M21 3L3 9.8L10.2 13.8" stroke="#423120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="salon-marker-label-copy"><span class="salon-marker-label-title"></span><span class="salon-marker-label-subtitle"></span></span>
    </div>
    <svg viewBox="0 0 64 82" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 79C28 66 5 52 5 31C5 14 17 3 32 3C47 3 59 14 59 31C59 52 36 66 32 79Z" fill="#43D59E" stroke="#087A5D" stroke-width="5"/>
      <circle cx="32" cy="31" r="18" fill="#FFFFFF" stroke="#171411" stroke-width="3"/>
      <g class="salon-pin-icon">${markerIcon === 'home' ? PIN_ICON_HOME : PIN_ICON_GLOBE}</g>
    </svg>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .salon-location-marker { position: relative; width: 46px; height: 60px; overflow: visible; }
    .salon-location-marker > svg { width: 46px; height: 60px; display: block; filter: drop-shadow(0 2px 2px rgba(0,0,0,.20)); }
    .salon-marker-label {
      position: absolute;
      bottom: 69px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 9px;
      width: max-content;
      min-width: 190px;
      max-width: min(290px, calc(100vw - 32px));
      min-height: 52px;
      padding: 0 14px 0 7px;
      box-sizing: border-box;
      border-radius: 11px;
      color: #423120;
      background: #F4EDE5;
      box-shadow: 0 4px 12px rgba(66,49,32,.18);
      font-family: Georgia, serif;
    }
    .salon-marker-label::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -9px;
      transform: translateX(-50%);
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid #F4EDE5;
    }
    .salon-marker-label-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-radius: 9px;
      background: #EDE3D8;
    }
    .salon-marker-label-icon svg { width: 21px; height: 21px; }
    .salon-marker-label-copy { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .salon-marker-label-title {
      display: block;
      overflow: hidden;
      color: #423120;
      font-size: 15px;
      line-height: 19px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .salon-marker-label-subtitle { color: #087A5D; font-size: 13px; line-height: 17px; font-weight: 700; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    ${MAPBOX_LOADER_JS}
    ${BUILDING_HIGHLIGHT_JS}
    var PITCH = use3d ? 45 : 0;
    var BEARING = use3d ? -17 : 0;

    var START = [${lng}, ${lat}];
    var map = null;
    var marker = null;
    var pending = null; // a setMarker call that arrived before the map loaded

    function post(lngLat, source) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'marker', lat: lngLat.lat, lng: lngLat.lng, source: source || 'unknown',
      }));
    }

    // The custom pin needs no map, so build it now: RN can update its label and
    // icon straight away.
    var markerElement = null;
    if (${JSON.stringify(markerVariant)} === 'location') {
      markerElement = document.createElement('div');
      markerElement.className = 'salon-location-marker';
      markerElement.innerHTML = ${JSON.stringify(locationMarkerHTML)};
      markerElement.querySelector('.salon-marker-label-title').textContent = ${JSON.stringify(compactMarkerLabel(markerLabel))};
      markerElement.querySelector('.salon-marker-label-subtitle').textContent = ${JSON.stringify(markerSubtitle)};
      markerElement.addEventListener('click', function (event) {
        event.stopPropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker-press' }));
      });
    }

    // Called from React Native when a text search resolves to coordinates.
    window.setMarker = function (lat, lng) {
      if (!map) { pending = [lng, lat]; return; }
      marker.setLngLat([lng, lat]);
      map.easeTo({ center: [lng, lat], zoom: 16, pitch: PITCH, bearing: BEARING });
      map.once('moveend', function () { highlightBuilding(map, [lng, lat]); });
    };
    window.setMarkerLabel = function (title, subtitle) {
      var label = markerElement && markerElement.querySelector('.salon-marker-label');
      if (!label) return;
      label.style.display = title ? 'flex' : 'none';
      label.querySelector('.salon-marker-label-title').textContent = title || '';
      label.querySelector('.salon-marker-label-subtitle').textContent = subtitle || '';
    };
    window.setMarkerIcon = function (icon) {
      var target = markerElement && markerElement.querySelector('.salon-pin-icon');
      if (!target) return;
      target.innerHTML = icon === 'home' ? ${JSON.stringify(PIN_ICON_HOME)} : ${JSON.stringify(PIN_ICON_GLOBE)};
    };

    loadMapbox(function () {
      mapboxgl.accessToken = '${MAPBOX_TOKEN}';
      var options = {
        container: 'map', style: MAPBOX_STYLE, center: START, attributionControl: false,
        zoom: ${initialZoom}, pitch: PITCH, bearing: BEARING
      };
      if (gl2) {
        options.config = {
          basemap: {
            lightPreset: lightPreset(),
            theme: 'faded',
            showPointOfInterestLabels: false,
            show3dObjects: use3d,
            colorBuildingSelect: '#D7C3A7' // same beige as the main map
          }
        };
      }
      map = new mapboxgl.Map(options);
      // Mapbox's terms require the logo and attribution: keep them, compact.
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));

      var markerOptions = markerElement
        ? { element: markerElement, anchor: 'bottom', draggable: true }
        : { color: '${darkBrown}', draggable: true };
      marker = new mapboxgl.Marker(markerOptions).setLngLat(START).addTo(map);

      marker.on('dragend', function () { post(marker.getLngLat(), 'marker-drag-end'); });
      var mapIsDragging = false;
      map.on('dragstart', function () { mapIsDragging = true; });
      map.on('move', function () {
        if (mapIsDragging) marker.setLngLat(map.getCenter());
      });
      map.on('dragstart', function () { highlightBuilding(map, null); });
      map.on('dragend', function () {
        mapIsDragging = false;
        var center = map.getCenter();
        marker.setLngLat(center);
        post(center, 'map-drag-end');
        highlightBuilding(map, center);
      });
      marker.on('dragstart', function () { highlightBuilding(map, null); });
      marker.on('dragend', function () { highlightBuilding(map, marker.getLngLat()); });
      // First full render: highlight the building under the starting pin.
      map.once('idle', function () { if (!pending) highlightBuilding(map, marker.getLngLat()); });

      if (pending) { window.setMarker(pending[1], pending[0]); pending = null; }
    });
  </script>
</body>
</html>`;
};

export default function AddressMapPicker({
  initialAddress,
  initialLat,
  initialLng,
  onChange,
  showSearch = true,
  showResolvedAddress = true,
  searchLeft = 16,
  markerVariant = 'default',
  markerLabel = '',
  markerSubtitle = '',
  markerIcon = 'globe',
  showMarkerLabel = true,
  onMarkerPress,
  onPinDrop,
}: Props) {
  const webRef = useRef<WebView>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startLat = initialLat ?? DEFAULT_LAT;
  const startLng = initialLng ?? DEFAULT_LNG;

  const [search, setSearch] = useState('');
  const [address, setAddress] = useState(initialAddress ?? '');
  const [resolving, setResolving] = useState(false);

  // Only build the HTML once so the WebView never reloads mid-interaction.
  const html = useMemo(
    () => buildHTML(
      startLat,
      startLng,
      markerVariant,
      markerLabel,
      markerSubtitle,
      markerIcon,
      showMarkerLabel,
      initialLat != null && initialLng != null,
    ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Turn coordinates into a readable street address.
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    setResolving(true);
    try {
      const finalAddress = await lookupAddress(latitude, longitude);
      setAddress(finalAddress);
      onChangeRef.current({ address: finalAddress, latitude, longitude });
    } finally {
      setResolving(false);
    }
  }, []);

  // If we arrived with an address but no coordinates, geocode it to place the marker.
  useEffect(() => {
    (async () => {
      if (initialLat != null && initialLng != null) {
        // Have coords already — normalise the address string from them.
        reverseGeocode(initialLat, initialLng);
        return;
      }
      if (initialAddress?.trim()) {
        try {
          const hit = await forwardGeocode(initialAddress.trim());
          if (hit) {
            webRef.current?.injectJavaScript(`window.setMarker(${hit.latitude}, ${hit.longitude}); true;`);
            reverseGeocode(hit.latitude, hit.longitude);
          }
        } catch { /* stay on Helsinki default */ }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.type === 'marker-press') {
        onMarkerPress?.();
        return;
      }
      if (msg?.type === 'marker' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        const pinWasDragged = msg.source === 'map-drag-end' || msg.source === 'marker-drag-end';
        if (
          Platform.OS === 'ios' &&
          pinWasDragged
        ) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        if (pinWasDragged) onPinDrop?.();
        reverseGeocode(msg.lat, msg.lng);
      }
    } catch { /* ignore malformed messages */ }
  }, [onMarkerPress, onPinDrop, reverseGeocode]);

  useEffect(() => {
    if (markerVariant !== 'location') return;
    const resolvedTitle = showMarkerLabel ? compactMarkerLabel(address || markerLabel) : '';
    webRef.current?.injectJavaScript(
      `window.setMarkerLabel(${JSON.stringify(resolvedTitle)}, ${JSON.stringify(markerSubtitle)}); true;`,
    );
  }, [address, markerLabel, markerSubtitle, markerVariant, showMarkerLabel]);

  useEffect(() => {
    if (markerVariant !== 'location') return;
    webRef.current?.injectJavaScript(
      `window.setMarkerIcon(${JSON.stringify(markerIcon)}); true;`,
    );
  }, [markerIcon, markerVariant]);

  // Forward-geocode the typed address, then move the marker to the result.
  const runSearch = useCallback(async () => {
    const query = search.trim();
    if (!query) return;
    setResolving(true);
    try {
      const hit = await forwardGeocode(query);
      if (hit) {
        webRef.current?.injectJavaScript(`window.setMarker(${hit.latitude}, ${hit.longitude}); true;`);
        reverseGeocode(hit.latitude, hit.longitude);
      } else {
        setResolving(false);
      }
    } catch {
      setResolving(false);
    }
  }, [search, reverseGeocode]);

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        startInLoadingState
      />

      {/* Floating search bar */}
      {showSearch && (
        <View
          style={{
            position: 'absolute', top: 12, left: searchLeft, right: 16,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: white, borderRadius: 14,
            borderWidth: 1.5, borderColor: beige,
            paddingHorizontal: 14, height: 50,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
          }}
        >
          <Ionicons name="search" size={18} color={darkBrown} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search an address…"
            placeholderTextColor="#bbb"
            returnKeyType="search"
            onSubmitEditing={runSearch}
            style={{ flex: 1, fontFamily: 'Philosopher-Regular', fontSize: 15, color: darkBrown }}
          />
          <TouchableOpacity onPress={runSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 14, color: darkBrown }}>Go</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resolved-address card */}
      {showResolvedAddress && (
        <View
          style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            backgroundColor: white, borderRadius: 14,
            borderWidth: 1.5, borderColor: beige, padding: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="location" size={16} color={darkBrown} style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 13, color: darkBrown }}>
              Your salon location
            </Text>
            {resolving ? <ActivityIndicator size="small" color={darkBrown} style={{ marginLeft: 8 }} /> : null}
          </View>
          <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 14, color: address ? darkBrown : '#aaa' }}>
            {address || 'Drag the pin or search to set your exact location'}
          </Text>
        </View>
      )}
    </View>
  );
}
