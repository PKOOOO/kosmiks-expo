import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_TOKEN, hasMapboxToken, MAP_UNAVAILABLE_HTML } from '@/config/constants';


// Helsinki — default center when we have no coordinates or address yet.
const DEFAULT_LAT = 60.1699;
const DEFAULT_LNG = 24.9384;

const darkBrown = '#423120';
const beige = '#D7C3A7';
const white = '#FFFFFF';

type Props = {
  initialAddress?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (data: { address: string; latitude: number; longitude: number }) => void;
};

// Build the Mapbox HTML once. The marker is draggable and the map is tappable;
// both post the new {lat,lng} back to React Native. `window.setMarker` lets RN
// move the marker after a text search resolves to coordinates.
const buildHTML = (lat: number, lng: number) => {
  // No token: show a static notice rather than a map whose accessToken
  // would be the literal string 'undefined'. hasMapboxToken() logs once.
  if (!hasMapboxToken()) return MAP_UNAVAILABLE_HTML;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-bottom-right { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = '${MAPBOX_TOKEN}';
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [${lng}, ${lat}],
      zoom: 13,
    });

    const marker = new mapboxgl.Marker({ color: '${darkBrown}', draggable: true })
      .setLngLat([${lng}, ${lat}])
      .addTo(map);

    function post(lngLat) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'marker', lat: lngLat.lat, lng: lngLat.lng,
      }));
    }

    marker.on('dragend', () => post(marker.getLngLat()));
    map.on('click', (e) => { marker.setLngLat(e.lngLat); post(e.lngLat); });

    // Called from React Native when a text search resolves to coordinates.
    window.setMarker = function (lat, lng) {
      marker.setLngLat([lng, lat]);
      map.easeTo({ center: [lng, lat], zoom: 15 });
    };
  </script>
</body>
</html>`;
};

export default function AddressMapPicker({ initialAddress, initialLat, initialLng, onChange }: Props) {
  const webRef = useRef<WebView>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startLat = initialLat ?? DEFAULT_LAT;
  const startLng = initialLng ?? DEFAULT_LNG;

  const [search, setSearch] = useState('');
  const [address, setAddress] = useState(initialAddress ?? '');
  const [resolving, setResolving] = useState(false);

  // Only build the HTML once so the WebView never reloads mid-interaction.
  const html = useMemo(() => buildHTML(startLat, startLng), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Turn coordinates into a readable street address (expo-location, no permission needed).
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const r = results[0];
      const line = r
        ? [
            [r.street, r.streetNumber].filter(Boolean).join(' '),
            r.postalCode,
            r.city,
            r.country,
          ].filter(Boolean).join(', ')
        : '';
      const finalAddress = line || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setAddress(finalAddress);
      onChangeRef.current({ address: finalAddress, latitude, longitude });
    } catch {
      const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setAddress(fallback);
      onChangeRef.current({ address: fallback, latitude, longitude });
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
          const [hit] = await Location.geocodeAsync(initialAddress.trim());
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
      if (msg?.type === 'marker' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        reverseGeocode(msg.lat, msg.lng);
      }
    } catch { /* ignore malformed messages */ }
  }, [reverseGeocode]);

  // Forward-geocode the typed address, then move the marker to the result.
  const runSearch = useCallback(async () => {
    const query = search.trim();
    if (!query) return;
    setResolving(true);
    try {
      const [hit] = await Location.geocodeAsync(query);
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
      <View
        style={{
          position: 'absolute', top: 12, left: 16, right: 16,
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

      {/* Resolved-address card */}
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
    </View>
  );
}
