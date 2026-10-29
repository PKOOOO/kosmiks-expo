import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Image, Dimensions, Linking } from 'react-native';
import { useFonts } from 'expo-font';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from 'expo-location';
import { WebView } from '@/components/WebView';
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import getSaloonsMap from "@/actions/get-saloons-map";
import getServices from "@/actions/get-services";
import { Saloon, Service } from "@/types";
import { MAPBOX_TOKEN, hasMapboxToken, MAP_UNAVAILABLE_HTML } from "@/config/constants";
import { describeError } from "@/lib/api";
import { useIsOffline, useOnReconnect } from "@/lib/network";
import RemoteImage from '@/components/RemoteImage';
import { getOpeningStatus, TimeSlot } from '@/lib/opening-hours';
import { MAPBOX_LOADER_JS, KOSMIKS_PIN_CSS, KOSMIKS_PIN_JS, BUILDING_HIGHLIGHT_JS } from '@/lib/map-html';

// Extended interface for map salon data
interface MapSalon extends Saloon {
  latitude: number;
  longitude: number;
  averageRating: number;
  reviewCount: number;
  timeSlots?: TimeSlot[];
  phone?: string | null;
}

type RouteProfile = 'walking' | 'driving';
type RouteState = {
  salonId: string;
  profile: RouteProfile;
  from: [number, number];
  status: 'loading' | 'ready' | 'error';
  duration?: number; // seconds
  distance?: number; // metres
};

// "12 min", "1 h 5 min"
const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
};

// "900 m", "1,2 km"
const formatDistance = (metres: number) =>
  metres < 1000
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0).replace('.', ',')} km`;

// Bottom salon cards: one card per screen width, with a peek of the next.
const CARD_WIDTH = Dimensions.get('window').width - 48;
const CARD_GAP = 12;

const normalizeSearchText = (value: string) => (value || '')
  .normalize('NFC')
  .toLocaleLowerCase('fi-FI')
  .replace(/\s+/g, ' ')
  .trim();


export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [salons, setSalons] = useState<MapSalon[]>([]);
  const [salonsLoading, setSalonsLoading] = useState(false);
  const [salonsFetchAttempted, setSalonsFetchAttempted] = useState(false);
  const [salonsError, setSalonsError] = useState<unknown>(null);
  const isOffline = useIsOffline();
  const [selectedSalon, setSelectedSalon] = useState<MapSalon | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isSalonDetailVisible, setSalonDetailVisible] = useState(false);
  const [selectedSalonForDetail, setSelectedSalonForDetail] = useState<MapSalon | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [filteredSalons, setFilteredSalons] = useState<MapSalon[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [displayedSalons, setDisplayedSalons] = useState<MapSalon[]>([]); // Salons to display in cards
  const [webViewRef, setWebViewRef] = useState<WebView | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [route, setRoute] = useState<RouteState | null>(null);
  const cardsFlatListRef = useRef<FlatList>(null);

  // Color scheme
  const darkBrown = "#423120";
  const lightBrown = "#D7C3A7";
  const veryLightBeige = "#F4EDE5";
  const white = "#FFFFFF";

  // Sample service providers data (fallback)
  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchSalons();
    }
  }, [userLocation]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load all services for search
  useEffect(() => {
    const loadServices = async () => {
      try {
        setSearchLoading(true);
        // Fetch all services by getting all categories first, then their services
        // Or use a different endpoint if available
        // For now, extract from salon data as fallback
        const fallbackServices = extractServicesFromSalons(salons);
        if (fallbackServices.length > 0) {
          setServices(fallbackServices);
          setFilteredServices(fallbackServices);
        }
      } catch (error) {
        console.error('Error loading services:', error);
        // Fallback: Extract services from salon data
        const fallbackServices = extractServicesFromSalons(salons);
        setServices(fallbackServices);
        setFilteredServices(fallbackServices);
      } finally {
        setSearchLoading(false);
      }
    };

    // Only load services after salons are loaded
    if (salons.length > 0) {
      loadServices();
    }
  }, [salons]);

  // Extract services from salons when they're loaded (fallback)
  useEffect(() => {
    if (salons.length > 0 && services.length === 0) {
      const fallbackServices = extractServicesFromSalons(salons);
      if (fallbackServices.length > 0) {
        setServices(fallbackServices);
        setFilteredServices(fallbackServices);
      }
    }
  }, [salons]);

  useEffect(() => {
    const normalizedQuery = normalizeSearchText(debouncedSearchQuery);

    if (!normalizedQuery) {
      setDisplayedSalons(salons);
      setFilteredSalons([]);
      setFilteredServices(services);
      return;
    }

    const matchingSalons = salons.filter((salon) =>
      normalizeSearchText(salon.name).includes(normalizedQuery)
    );
    const matchingServices = services.filter((service) =>
      normalizeSearchText(service.name).includes(normalizedQuery)
    );

    setDisplayedSalons(matchingSalons);
    setFilteredSalons(matchingSalons);
    setFilteredServices(matchingServices);
  }, [debouncedSearchQuery, salons, services]);

  const fetchSalons = async () => {
    try {
      setSalonsFetchAttempted(true);
      setSalonsLoading(true);
      setSalonsError(null);
      const salonsData = await getSaloonsMap({
        lat: userLocation?.latitude,
        lng: userLocation?.longitude,
        radius: 10
      });

      // Filter out salons without coordinates and check if we have valid salons
      const validSalons = salonsData.filter(salon =>
        salon.latitude && salon.longitude &&
        salon.latitude !== null && salon.longitude !== null
      ) as unknown as MapSalon[];

      // Only ever show real salons that have coordinates. If none exist yet,
      // show an empty map (empty state) rather than fake pins.
      setSalons(validSalons);
      setDisplayedSalons(validSalons);
    } catch (error) {
      console.warn('Error fetching salons from API:', error);
      setSalonsError(error);
      setSalons([]);
      setDisplayedSalons([]);
      setServices([]);
      setFilteredServices([]);
    } finally {
      setSalonsLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show nearby service providers.'
        );
        setLoading(false);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      // Default to Helsinki if location fails
      setUserLocation({
        latitude: 60.1699,
        longitude: 24.9384
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync FlatList when selectedSalon changes externally (e.g., marker click)
  useEffect(() => {
    if (selectedSalon && displayedSalons.length > 0) {
      const index = displayedSalons.findIndex(s => s.id === selectedSalon.id);
      if (index !== -1 && index !== activeCardIndex) {
        setActiveCardIndex(index);
        // Use setTimeout to ensure FlatList is ready
        setTimeout(() => {
          try {
            cardsFlatListRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.5
            });
          } catch {
            // Fallback to scrollToOffset if scrollToIndex fails
            const cardWidth = Dimensions.get('window').width - 50;
            cardsFlatListRef.current?.scrollToOffset({
              offset: index * (cardWidth + 20),
              animated: true
            });
          }
        }, 100);
      }
    }
  }, [selectedSalon?.id, displayedSalons]);

  const centerOnUserLocation = () => {
    if (userLocation) {
      // Send message to WebView to center on user location
      const message = JSON.stringify({
        type: 'centerOnLocation',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      });
      // This will be handled by the WebView
    }
  };

  // Fly the map to a salon and highlight it (pin + 3D building).
  const centerMapOnSalon = (salon: MapSalon) => {
    if (webViewRef) {
      webViewRef.postMessage(JSON.stringify({ type: 'selectSalon', salonId: salon.id }));
    }
    setSearchVisible(false);
  };

  // Navigate to salon-sector page (used when clicking salon in list)
  const navigateToSalonSector = (salon: MapSalon) => {
    // First center the map
    if (webViewRef) {
      const message = JSON.stringify({
        type: 'centerOnLocation',
        latitude: salon.latitude,
        longitude: salon.longitude,
      });
      webViewRef.postMessage(message);
    }
    setSearchVisible(false);
    // Then navigate to salon-sector page to show categories for this salon
    router.push({
      pathname: "/salon-sector",
      params: {
        salonId: salon.id,
        salonName: salon.name
      }
    });
  };

  // Handle salon card click - show detail modal
  const handleSalonCardPress = (salon: MapSalon) => {
    setSelectedSalonForDetail(salon);
    setSalonDetailVisible(true);
  };

  // Close salon detail modal
  const closeSalonDetailModal = () => {
    setSalonDetailVisible(false);
    setSelectedSalonForDetail(null);
  };

  // Directions: draw the route from the user to the salon on our own map.
  const sendRoute = (next: RouteState, salon: MapSalon) => {
    webViewRef?.postMessage(JSON.stringify({
      type: 'showRoute',
      from: next.from,
      to: [Number(salon.longitude), Number(salon.latitude)],
      profile: next.profile,
    }));
  };

  const handleDirections = async (salon: MapSalon, profile: RouteProfile = route?.profile ?? 'walking') => {
    closeSalonDetailModal();
    setSelectedSalon(salon);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        Alert.alert(
          'Sijainti tarvitaan',
          'Salli sijainti, niin näytämme reitin salonkiin.',
          [
            { text: 'Peruuta', style: 'cancel' },
            { text: 'Asetukset', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      setRoute({ salonId: salon.id, profile, from: route?.from ?? [0, 0], status: 'loading' });
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next: RouteState = {
        salonId: salon.id,
        profile,
        from: [position.coords.longitude, position.coords.latitude],
        status: 'loading',
      };
      setRoute(next);
      sendRoute(next, salon);
    } catch (error) {
      console.warn('Directions failed:', error);
      setRoute((current) => current && { ...current, status: 'error' });
    }
  };

  const changeRouteProfile = (profile: RouteProfile) => {
    if (!route || route.profile === profile) return;
    const salon = salons.find((s) => s.id === route.salonId);
    if (!salon) return;
    const next: RouteState = { ...route, profile, status: 'loading', duration: undefined, distance: undefined };
    setRoute(next);
    sendRoute(next, salon);
  };

  const clearRoute = () => {
    setRoute(null);
    webViewRef?.postMessage(JSON.stringify({ type: 'clearRoute' }));
    if (selectedSalon) centerMapOnSalon(selectedSalon);
  };

  // Swiping to another salon ends the route to the previous one.
  useEffect(() => {
    if (route && selectedSalon && selectedSalon.id !== route.salonId) {
      setRoute(null);
      webViewRef?.postMessage(JSON.stringify({ type: 'clearRoute' }));
    }
  }, [selectedSalon?.id]);

  // Call: open the phone's dialler with the salon's number.
  const handleCall = (salon: MapSalon) => {
    const number = salon.phone?.replace(/[^\d+]/g, '');
    if (!number) return;
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Puhelu ei onnistunut', `Soita numeroon ${salon.phone}`);
    });
  };

  // Navigate to services
  const handleViewServices = (salon: MapSalon) => {
    closeSalonDetailModal();
    router.push({
      pathname: '/services',
      params: {
        salonId: salon.id,
        salonName: salon.name,
        categoryName: 'Kaikki palvelut'
      }
    });
  };

  // Extract services from salon data as fallback
  const extractServicesFromSalons = (salonData: MapSalon[]): Service[] => {
    const serviceMap = new Map<string, Service>();

    salonData.forEach(salon => {
      // Check if salon has saloonServices
      if (salon.saloonServices && Array.isArray(salon.saloonServices)) {
        salon.saloonServices.forEach(saloonService => {
          if (saloonService.service) {
            const service = saloonService.service;
            if (!serviceMap.has(service.id)) {
              serviceMap.set(service.id, {
                ...service,
                isPopular: service.isPopular || false,
                subServices: service.subServices || [],
                saloonServices: service.saloonServices || [],
              });
            }
          }
        });
      }
    });

    return Array.from(serviceMap.values());
  };

  // Search functionality
  const handleSearchPress = () => {
    setSearchVisible(true);
  };

  const handleSearchQuery = (query: string) => {
    setSearchQuery(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setDisplayedSalons(salons);
    setFilteredSalons([]);
    setFilteredServices(services);
  };

  const handleServiceSelect = async (service: Service) => {
    try {
      setSearchLoading(true);
      setSearchVisible(false);

      // Filter salons that offer this service
      // For now, we'll show all salons since we don't have service data in MapSalon
      // In a real implementation, you'd need to fetch salon services or include them in the map data
      const salonsWithService = salons; // Show all salons for now

      if (salonsWithService.length > 0) {
        // Calculate center point of salons with this service
        const avgLat = salonsWithService.reduce((sum, salon) => sum + salon.latitude, 0) / salonsWithService.length;
        const avgLng = salonsWithService.reduce((sum, salon) => sum + salon.longitude, 0) / salonsWithService.length;

        // Send message to WebView to zoom to these salons
        if (webViewRef) {
          const message = JSON.stringify({
            type: 'zoomToService',
            center: { latitude: avgLat, longitude: avgLng },
            salons: salonsWithService,
            serviceName: service.name
          });
          webViewRef.postMessage(message);
        }

        Alert.alert(
          'Palvelu löytyi!',
          `Löytyi ${salonsWithService.length} salon ${service.name} palvelulla. Kartta on keskitetty näihin saloneihin.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Palvelua ei löytynyt',
          `Valitettavasti kukaan salon ei tarjoa "${service.name}" palvelua tällä hetkellä.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error filtering salons by service:', error);
      Alert.alert('Virhe', 'Palvelun hakemisessa tapahtui virhe.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Generate HTML for the map
  const generateMapHTML = () => {
    // No token: return a static notice rather than a map whose accessToken
    // would be the literal string 'undefined'. hasMapboxToken() logs once.
    if (!hasMapboxToken()) return MAP_UNAVAILABLE_HTML;

    const centerLat = userLocation?.latitude || 60.1699;
    const centerLng = userLocation?.longitude || 24.9384;

    const markers = displayedSalons
      .filter((salon) => Number.isFinite(Number(salon.latitude)) && Number.isFinite(Number(salon.longitude)))
      .map((salon) => ({
        id: salon.id,
        name: salon.name,
        lat: Number(salon.latitude),
        lng: Number(salon.longitude),
      }));

    // Everything below runs inside the WebView. Mapbox GL JS v3 with the
    // Standard style (3D buildings, light presets) when the device has WebGL2;
    // otherwise the previous v2 + streets-v12 map, so it never goes blank.
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Map</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Philosopher:wght@700&display=swap" rel="stylesheet">
        <style>
          html, body { margin: 0; padding: 0; height: 100%; }
          #map { width: 100%; height: 100vh; }
          a { pointer-events: none; }
          * { -webkit-touch-callout: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
          .mapboxgl-popup-content {
            border-radius: 14px;
            padding: 14px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .popup-title { font-weight: bold; font-size: 16px; margin-bottom: 6px; color: #423120; }
          .popup-details { font-size: 14px; color: #5c4a38; margin-bottom: 4px; }

          ${KOSMIKS_PIN_CSS}

          /* You-are-here dot */
          .me { width: 16px; height: 16px; border-radius: 50%; background: #007AFF; border: 3px solid #FFFFFF; box-shadow: 0 0 0 6px rgba(0, 122, 255, 0.2); }
        </style>
      </head>
      <body>
        <div id='map'></div>
        <script>
          var TOKEN = '${MAPBOX_TOKEN}';
          var CENTER = [${centerLng}, ${centerLat}];
          var ME = ${userLocation ? JSON.stringify([userLocation.longitude, userLocation.latitude]) : 'null'};
          var SALONS = ${JSON.stringify(markers)};
          var MAP_PAD = { top: 70, bottom: 300 }; // keeps the selected salon between the search bar and the cards

          ${MAPBOX_LOADER_JS}
          ${KOSMIKS_PIN_JS}
          ${BUILDING_HIGHLIGHT_JS}
          var PITCH = use3d ? 55 : 0;
          var BEARING = use3d ? -17 : 0;

          var map = null;
          var markerEls = {};
          var selectedId = null;
          var byId = {};
          SALONS.forEach(function (s) { byId[s.id] = s; });

          function post(message) {
            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }

          function selectSalon(id, fly) {
            var salon = byId[id];
            if (!salon || !map) return;
            if (selectedId && markerEls[selectedId]) markerEls[selectedId].classList.remove('selected');
            selectedId = id;
            if (markerEls[id]) markerEls[id].classList.add('selected');
            if (fly) {
              map.flyTo({ center: [salon.lng, salon.lat], zoom: 16.2, pitch: PITCH, bearing: BEARING, duration: 1400, padding: MAP_PAD });
              map.once('moveend', function () { highlightBuilding(map, [salon.lng, salon.lat]); });
            } else {
              highlightBuilding(map, [salon.lng, salon.lat]);
            }
          }

          // In-app route from the user to a salon (Mapbox Directions API).
          var meMarker = null;
          var routeRequest = 0;
          function setMe(lngLat) {
            if (!meMarker) {
              var me = document.createElement('div');
              me.className = 'me';
              meMarker = new mapboxgl.Marker({ element: me });
            }
            meMarker.setLngLat(lngLat).addTo(map);
          }

          function clearRoute() {
            routeRequest++;
            if (map.getLayer('route-line')) map.removeLayer('route-line');
            if (map.getLayer('route-casing')) map.removeLayer('route-casing');
            if (map.getSource('route')) map.removeSource('route');
          }

          function routeLayer(id, color, width) {
            var paint = { 'line-color': color, 'line-width': width };
            if (gl2) paint['line-emissive-strength'] = 1; // stays bright at night
            var layer = { id: id, type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: paint };
            if (gl2) layer.slot = 'top'; // 'middle' hides the line behind 3D buildings
            return layer;
          }

          function showRoute(from, to, profile) {
            var request = ++routeRequest;
            setMe(from);
            var url = 'https://api.mapbox.com/directions/v5/mapbox/' + profile + '/' +
              from[0] + ',' + from[1] + ';' + to[0] + ',' + to[1] +
              '?geometries=geojson&overview=full&access_token=' + TOKEN;
            fetch(url).then(function (res) { return res.json(); }).then(function (json) {
              if (request !== routeRequest) return; // a newer request replaced this one
              var found = json && json.routes && json.routes[0];
              if (!found) { post({ type: 'routeError' }); return; }
              var data = { type: 'Feature', properties: {}, geometry: found.geometry };
              if (map.getSource('route')) {
                map.getSource('route').setData(data);
              } else {
                map.addSource('route', { type: 'geojson', data: data });
                map.addLayer(routeLayer('route-casing', '#FFFFFF', 10));
                map.addLayer(routeLayer('route-line', '#423120', 6));
              }
              var bounds = new mapboxgl.LngLatBounds(from, from);
              found.geometry.coordinates.forEach(function (c) { bounds.extend(c); });
              bounds.extend(to);
              map.fitBounds(bounds, {
                padding: { top: 150, bottom: 320, left: 50, right: 50 },
                pitch: PITCH, bearing: BEARING, maxZoom: 16.5, duration: 1400
              });
              post({ type: 'routeReady', duration: found.duration, distance: found.distance });
            }).catch(function () {
              if (request === routeRequest) post({ type: 'routeError' });
            });
          }

          function handleMessage(event) {
            var data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            if (!map) return;
            if (data.type === 'selectSalon') {
              selectSalon(data.salonId, true);
            } else if (data.type === 'showRoute') {
              showRoute(data.from, data.to, data.profile);
            } else if (data.type === 'clearRoute') {
              clearRoute();
            } else if (data.type === 'centerOnLocation') {
              map.flyTo({ center: [data.longitude, data.latitude], zoom: 15, pitch: PITCH, duration: 1600, padding: MAP_PAD });
            } else if (data.type === 'zoomToService') {
              map.flyTo({ center: [data.center.longitude, data.center.latitude], zoom: 14, duration: 1600, padding: MAP_PAD });
              setTimeout(function () {
                new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 25 })
                  .setLngLat([data.center.longitude, data.center.latitude])
                  .setHTML(
                    '<div class="popup-title">' + data.serviceName + '</div>' +
                    '<div class="popup-details">Löytyi ' + data.salons.length + ' salonkia tällä palvelulla</div>'
                  )
                  .addTo(map);
              }, 1600);
            }
          }
          // iOS delivers postMessage on window, Android on document.
          window.addEventListener('message', handleMessage);
          document.addEventListener('message', handleMessage);

          // Prevent any default link behaviour (Mapbox attribution links).
          document.addEventListener('click', function (e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); }
          }, true);

          function init() {
            mapboxgl.accessToken = TOKEN;
            var options = { container: 'map', center: CENTER, zoom: 14.5 };
            if (gl2) {
              options.style = MAPBOX_STYLE;
              options.config = {
                basemap: {
                  lightPreset: lightPreset(),
                  theme: 'faded',
                  showPointOfInterestLabels: false, // only Kosmiks salons stand out
                  show3dObjects: use3d,
                  colorBuildingSelect: '#D7C3A7', // pin ring beige: marks the building without hiding the pin
                  colorBuildingHighlight: '#D7C3A7'
                }
              };
              options.pitch = PITCH;
              options.bearing = BEARING;
            } else {
              options.style = MAPBOX_STYLE;
            }
            map = new mapboxgl.Map(options);

            if (gl2) {
              setInterval(function () {
                try { map.setConfigProperty('basemap', 'lightPreset', lightPreset()); } catch (e) {}
              }, 10 * 60 * 1000);
            }

            if (ME) setMe(ME);

            SALONS.forEach(function (salon) {
              var pin = makeKosmiksPin(salon.name, false);
              pin.addEventListener('click', function (e) {
                e.stopPropagation();
                selectSalon(salon.id, true);
                post({ type: 'markerTap', salonId: salon.id });
              });
              markerEls[salon.id] = pin;
              new mapboxgl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([salon.lng, salon.lat]).addTo(map);
            });

            map.on('load', function () { post({ type: 'mapReady', engine: MAPBOX_VERSION, threeD: use3d }); });
          }

          loadMapbox(init);
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'viewServices') {
        // Navigate to services page with salon information
        const salon = salons.find(s => s.id === data.salonId);
        if (salon) {
          // Navigate to services page - you can pass salon info as params
          router.push({
            pathname: '/services',
            params: {
              salonId: salon.id,
              salonName: salon.name,
              categoryName: 'Kaikki palvelut' // or get from salon services
            }
          });
        }
      } else if (data.type === 'mapReady') {
        // The map finished loading after the first card was selected: show it now.
        console.log('[MAP] ready, engine', data.engine, '3D:', data.threeD);
        if (selectedSalon) centerMapOnSalon(selectedSalon);
        // The page reloaded with a route showing: draw it again.
        const routeSalon = route && salons.find((s) => s.id === route.salonId);
        if (route && routeSalon && route.status !== 'error') sendRoute(route, routeSalon);
      } else if (data.type === 'routeReady') {
        setRoute((current) => current && { ...current, status: 'ready', duration: data.duration, distance: data.distance });
      } else if (data.type === 'routeError') {
        setRoute((current) => current && { ...current, status: 'error' });
      } else if (data.type === 'markerTap' || data.type === 'salonSelected') {
        // A pin was tapped: show that salon's card (the map already flew there).
        const salon = salons.find(s => s.id === data.salonId);
        if (salon) {
          setSelectedSalon(salon);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const activeSearchLabel = debouncedSearchQuery.replace(/\s+/g, ' ').trim();
  const hasActiveSearch = normalizeSearchText(debouncedSearchQuery).length > 0;
  const showFetchError = salonsFetchAttempted && !salonsLoading && salonsError != null;
  const fetchErrorCopy = describeError(salonsError, isOffline);

  // Reload pins automatically once the connection comes back.
  useOnReconnect(() => {
    if (salonsError != null) fetchSalons();
  });
  const showPlatformEmpty = salonsFetchAttempted && !salonsLoading && !salonsError && salons.length === 0;
  const showNoSearchResults = salonsFetchAttempted
    && !salonsLoading
    && !salonsError
    && salons.length > 0
    && hasActiveSearch
    && displayedSalons.length === 0;

  if (loading) {
    return (
      <View collapsable={false} style={[styles.container, { backgroundColor: white }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkBrown} />
          <Text style={[styles.loadingText, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
            Ladataan karttaa...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View collapsable={false} style={[styles.container, { backgroundColor: white }]}>
      {/* Kosmiks Header */}
      <Header
        title="KOSMIKS"
        showBack={true}
        showMenu={true}
        onMenuPress={() => setMenuVisible(true)}
        onBackPress={() => router.back()}
      />

      {/* Map */}
      <View style={styles.mapContainer}>

        <WebView

          ref={setWebViewRef}
          source={{ html: generateMapHTML() }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          nestedScrollEnabled={true}
          onShouldStartLoadWithRequest={(request) => {
            // Allow initial load and data URLs (for map interactions)
            if (request.navigationType === 'other' || request.url.startsWith('data:')) {
              return true; // Allow initial load and data URLs
            }
            // Block external navigation (links, etc.) but allow mapbox resources
            if (request.url.startsWith('http://') || request.url.startsWith('https://')) {
              // Allow mapbox resources
              if (request.url.includes('mapbox.com') || request.url.includes('mapboxgl')) {
                return true;
              }
              return false; // Block other external links
            }
            return true; // Allow other navigation (map interactions)
          }}

          allowsBackForwardNavigationGestures={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={darkBrown} />
              <Text style={[styles.loadingText, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                Ladataan karttaa...
              </Text>
            </View>
          )}
        />

        {/* Search bar, floating at the top of the map; the route panel replaces it while a route shows */}
        {route ? (
          <View style={styles.topSearchContainer}>
            <View style={styles.routePanel}>
              {(['walking', 'driving'] as const).map((profile) => (
                <TouchableOpacity
                  key={profile}
                  style={[styles.routeModeButton, route.profile === profile && { backgroundColor: darkBrown }]}
                  onPress={() => changeRouteProfile(profile)}
                  accessibilityRole="button"
                  accessibilityLabel={profile === 'walking' ? 'Kävely' : 'Auto'}
                  accessibilityState={{ selected: route.profile === profile }}
                >
                  <Ionicons name={profile === 'walking' ? 'walk' : 'car'} size={18} color={route.profile === profile ? white : darkBrown} />
                </TouchableOpacity>
              ))}
              <View style={styles.routeInfo}>
                {route.status === 'loading' ? (
                  <Text style={styles.routeInfoMain}>Haetaan reittiä…</Text>
                ) : route.status === 'error' ? (
                  <Text style={styles.routeInfoMain}>Reittiä ei löytynyt</Text>
                ) : (
                  <Text style={styles.routeInfoMain} numberOfLines={1}>
                    {formatDuration(route.duration ?? 0)} · {formatDistance(route.distance ?? 0)}
                  </Text>
                )}
                <Text style={styles.routeInfoSub} numberOfLines={1}>
                  {salons.find((s) => s.id === route.salonId)?.name ?? ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={clearRoute}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Sulje reitti"
              >
                <Ionicons name="close-circle" size={26} color={darkBrown} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.topSearchContainer}>
            <View style={styles.topSearchBar}>
              <Ionicons name="search" size={20} color={darkBrown} style={styles.topSearchIcon} />
              <TextInput
                style={[styles.topSearchText, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}
                value={searchQuery}
                onChangeText={handleSearchQuery}
                placeholder="Etsi Salonki.."
                placeholderTextColor="#999"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={clearSearch}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={22} color={darkBrown} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Salon cards along the bottom, clear of the Mapbox logo */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingBottom: (Platform.OS === 'ios' ? 32 : 62) + insets.bottom,
          }}
        >
          {/* Salon cards: swipe between salons; the map follows and highlights each one */}
          {displayedSalons.length > 0 && (
            <FlatList
              ref={cardsFlatListRef}
              data={displayedSalons}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.cardsContentContainer}
              bounces={false}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + CARD_GAP,
                offset: 20 + index * (CARD_WIDTH + CARD_GAP),
                index,
              })}
              onViewableItemsChanged={({ viewableItems }) => {
                const index = viewableItems[0]?.index;
                if (index != null) {
                  const salon = displayedSalons[index];
                  setActiveCardIndex(index);
                  setSelectedSalon(salon);
                  centerMapOnSalon(salon);
                }
              }}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              renderItem={({ item: salon }) => {
                const status = getOpeningStatus(salon.timeSlots);
                const photoCount = salon.images?.length ?? 0;
                const rating = salon.averageRating || salon.rating || 0;
                return (
                  <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.9}
                    onPress={() => handleSalonCardPress(salon)}
                    accessibilityRole="button"
                    accessibilityLabel={`${salon.name}, näytä tiedot`}
                  >
                    <View>
                      <RemoteImage
                        source={{ uri: salon.images?.[0]?.url }}
                        style={styles.cardPhoto}
                        resizeMode="cover"
                      />
                      {photoCount > 1 && (
                        <View style={styles.cardPhotoCount}>
                          <Ionicons name="images-outline" size={13} color={white} />
                          <Text style={styles.cardPhotoCountText}>{photoCount}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName} numberOfLines={1}>{salon.name}</Text>
                        <View style={styles.cardRatingPill}>
                          <Ionicons name="star" size={13} color={darkBrown} />
                          <Text style={styles.cardRatingText}>
                            {salon.reviewCount > 0 ? `${rating.toFixed(1)} (${salon.reviewCount})` : 'Uusi'}
                          </Text>
                        </View>
                      </View>

                      {status && (
                        <View style={styles.cardInfoRow}>
                          <View style={[styles.cardStatusDot, { backgroundColor: status.open ? '#2E7D4F' : '#B3261E' }]} />
                          <Text style={[styles.cardInfoText, { color: status.open ? '#2E7D4F' : '#B3261E' }]} numberOfLines={1}>
                            {status.label}
                          </Text>
                        </View>
                      )}

                      {!!salon.address && (
                        <View style={styles.cardInfoRow}>
                          <Ionicons name="location-outline" size={15} color={darkBrown} />
                          <Text style={styles.cardInfoText} numberOfLines={1}>{salon.address}</Text>
                        </View>
                      )}

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.cardButton, styles.cardButtonOutline]}
                          onPress={() => handleDirections(salon)}
                          accessibilityRole="button"
                        >
                          <Ionicons name="navigate-outline" size={16} color={darkBrown} />
                          <Text style={[styles.cardButtonText, { color: darkBrown }]}>Reittiohjeet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cardButton, styles.cardButtonFilled]}
                          onPress={() => handleViewServices(salon)}
                          accessibilityRole="button"
                        >
                          <Ionicons name="calendar-outline" size={16} color={white} />
                          <Text style={[styles.cardButtonText, { color: white }]}>Varaa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {showFetchError && (
          <View style={[styles.mapStatePanel, { bottom: 150 + insets.bottom }]}>
            <Ionicons name="cloud-offline-outline" size={22} color={darkBrown} style={styles.mapStateIcon} />
            <Text style={styles.mapStateTitle}>{fetchErrorCopy.title}</Text>
            <Text style={styles.mapStateMessage}>{fetchErrorCopy.message}</Text>
            <TouchableOpacity
              style={styles.mapStateAction}
              onPress={() => fetchSalons()}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={17} color={white} />
              <Text style={styles.mapStateActionText}>Yritä uudelleen</Text>
            </TouchableOpacity>
          </View>
        )}

        {showPlatformEmpty && (
          <View pointerEvents="none" style={[styles.mapStatePanel, { bottom: 150 + insets.bottom }]}>
            <Ionicons name="location-outline" size={22} color={darkBrown} style={styles.mapStateIcon} />
            <Text style={styles.mapStateTitle}>
              Ei vielä salonkeja
            </Text>
            <Text style={styles.mapStateMessage}>
              Uudet salongit näkyvät täällä, kun ne liittyvät palveluun.
            </Text>
          </View>
        )}

        {showNoSearchResults && (
          <View style={[styles.mapStatePanel, { bottom: 150 + insets.bottom }]}>
            <Ionicons name="search-outline" size={22} color={darkBrown} style={styles.mapStateIcon} />
            <Text style={styles.mapStateTitle}>Ei tuloksia haulle '{activeSearchLabel}'</Text>
            <Text style={styles.mapStateMessage}>Tarkista kirjoitusasu tai kokeile toista hakua.</Text>
            <TouchableOpacity
              style={styles.mapStateAction}
              onPress={clearSearch}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={17} color={white} />
              <Text style={styles.mapStateActionText}>Tyhjennä haku</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* Modal for the side menu */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMenuVisible}
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent={true}
      >
        <SideMenu onClose={() => setMenuVisible(false)} />
      </Modal>

      {/* Search Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSearchVisible}
        onRequestClose={() => setSearchVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'android' ? insets.bottom : 0}
        >
          <View style={styles.searchModalOverlay}>
            <View style={[styles.searchModalContent, { paddingBottom: insets.bottom + 20 }]}>
              {/* Search Header */}
              <View style={styles.searchHeader}>
                <Text style={[styles.searchTitle, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                  Etsi palvelua
                </Text>
                <TouchableOpacity onPress={() => setSearchVisible(false)}>
                  <Ionicons name="close" size={24} color={darkBrown} />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color={darkBrown} style={styles.searchInputIcon} />
                <TextInput
                  style={[styles.searchInput, { color: darkBrown, fontFamily: 'Philosopher-Regular' }]}
                  placeholder="Kirjoita palvelun nimi..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={handleSearchQuery}
                  autoFocus={true}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    if (filteredSalons.length > 0) {
                      centerMapOnSalon(filteredSalons[0]);
                    } else if (filteredServices.length > 0) {
                      handleServiceSelect(filteredServices[0]);
                    }
                  }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={clearSearch}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={20} color={darkBrown} />
                  </TouchableOpacity>
                )}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => {
                      if (filteredSalons.length > 0) {
                        centerMapOnSalon(filteredSalons[0]);
                      } else if (filteredServices.length > 0) {
                        handleServiceSelect(filteredServices[0]);
                      }
                    }}
                    disabled={filteredSalons.length === 0 && filteredServices.length === 0}
                  >
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={(filteredSalons.length > 0 || filteredServices.length > 0) ? darkBrown : "#ccc"}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Action Button */}



              {/* Salons and Services List */}
              {searchLoading ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="large" color={darkBrown} />
                  <Text style={[styles.searchLoadingText, { color: darkBrown, fontFamily: 'Philosopher-Regular' }]}>
                    Ladataan palveluja...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={[
                    ...filteredSalons.map(s => ({ type: 'salon', key: `salon-${s.id}`, salon: s })),
                    ...filteredServices.map(s => ({ type: 'service', key: `service-${s.id}`, service: s })),
                  ]}
                  keyExtractor={(item) => item.key}
                  style={styles.servicesList}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const it: any = item;
                    return it.type === 'salon' ? (
                      <TouchableOpacity
                        style={styles.serviceItem}
                        onPress={() => navigateToSalonSector(it.salon)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.serviceName, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                          {it.salon.name}
                        </Text>
                        {it.salon.address ? (
                          <Text style={[styles.serviceDescription, { color: '#666', fontFamily: 'Philosopher-Regular' }]}>
                            {it.salon.address}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.serviceItem}
                        onPress={() => handleServiceSelect(it.service)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.serviceName, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                          {it.service.name}
                        </Text>
                        {it.service.description && (
                          <Text style={[styles.serviceDescription, { color: '#666', fontFamily: 'Philosopher-Regular' }]}>
                            {it.service.description}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: darkBrown, fontFamily: 'Philosopher-Regular' }]}>
                        {searchQuery ? 'Ei tuloksia – kokeile toista hakusanaa' : 'Aloita kirjoittamalla palvelun tai salon nimen'}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Salon Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSalonDetailVisible}
        onRequestClose={closeSalonDetailModal}
      >
        <View style={styles.salonDetailOverlay}>
          <TouchableOpacity
            style={styles.salonDetailBackdrop}
            activeOpacity={1}
            onPress={closeSalonDetailModal}
          />
          <View
            style={[
              styles.salonDetailContent,
              {
                width: '100%',
                // transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {selectedSalonForDetail && (
              <>
                {/* Close Button */}
                <TouchableOpacity
                  style={styles.salonDetailCloseButton}
                  onPress={closeSalonDetailModal}
                >
                  <Ionicons name="close" size={28} color={darkBrown} />
                </TouchableOpacity>

                {/* Salon Image */}
                <View style={styles.salonDetailImageContainer}>
                  {selectedSalonForDetail.images && selectedSalonForDetail.images.length > 0 ? (
                    <RemoteImage
                      source={{ uri: selectedSalonForDetail.images[0].url }}
                      style={styles.salonDetailImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.salonDetailImage, styles.salonDetailImagePlaceholder]}>
                      <Ionicons name="business-outline" size={64} color={darkBrown} />
                    </View>
                  )}
                </View>

                {/* Salon Info */}
                <View style={styles.salonDetailInfo}>
                  {/* Salon Name */}
                  <Text style={[styles.salonDetailName, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                    {selectedSalonForDetail.name}
                  </Text>

                  {/* Rating */}
                  <View style={styles.salonDetailRatingRow}>
                    {selectedSalonForDetail.reviewCount > 0 ? (
                      <>
                        <Text style={[styles.salonDetailRating, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                          {selectedSalonForDetail.averageRating.toFixed(1)}
                        </Text>
                        <Text style={[styles.salonDetailStar, { color: darkBrown }]}>
                          ⭐
                        </Text>
                        <Text style={[styles.salonDetailReviewCount, { color: '#666', fontFamily: 'Philosopher-Regular' }]}>
                          • {selectedSalonForDetail.reviewCount} {selectedSalonForDetail.reviewCount === 1 ? 'arvostelu' : 'arvostelua'}
                        </Text>
                      </>
                    ) : (
                      // Same label as the map card while a salon has no reviews.
                      <Text style={[styles.salonDetailRating, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                        ★ Uusi
                      </Text>
                    )}
                  </View>

                  {/* Short Intro */}
                  {selectedSalonForDetail.shortIntro && (
                    <Text style={[styles.salonDetailIntro, { color: '#666', fontFamily: 'Philosopher-Regular' }]}>
                      {selectedSalonForDetail.shortIntro}
                    </Text>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.salonDetailActions}>
                    {/* Directions Button */}
                    <TouchableOpacity
                      style={[styles.salonDetailActionButton, styles.salonDetailActionButtonPrimary]}
                      onPress={() => handleDirections(selectedSalonForDetail)}
                    >
                      <Ionicons name="navigate" size={20} color={white} />
                      <Text style={[styles.salonDetailActionButtonText, { color: white, fontFamily: 'Philosopher-Bold' }]}>
                        Reitti
                      </Text>
                    </TouchableOpacity>

                    {/* Call Button: opens the dialler with the salon's number */}
                    {!!selectedSalonForDetail.phone && (
                    <TouchableOpacity
                      style={[styles.salonDetailActionButton, styles.salonDetailActionButtonSecondary]}
                      onPress={() => handleCall(selectedSalonForDetail)}
                    >
                      <Ionicons name="call" size={20} color={darkBrown} />
                      <Text style={[styles.salonDetailActionButtonText, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                        Soita
                      </Text>
                    </TouchableOpacity>
                    )}
                  </View>

                  {/* View Services Button */}
                  <TouchableOpacity
                    style={[styles.salonDetailServicesButton, { backgroundColor: darkBrown }]}
                    onPress={() => handleViewServices(selectedSalonForDetail)}
                  >
                    <Text style={[styles.salonDetailServicesButtonText, { color: white, fontFamily: 'Philosopher-Bold' }]}>
                      Katso palvelut
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapStatePanel: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7C3A7',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 11,
  },
  mapStateIcon: {
    marginBottom: 6,
  },
  mapStateTitle: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 15,
    color: '#423120',
    textAlign: 'center',
  },
  mapStateMessage: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 13,
    color: '#77695C',
    marginTop: 3,
    textAlign: 'center',
  },
  mapStateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#423120',
  },
  mapStateActionText: {
    color: '#FFFFFF',
    fontFamily: 'Philosopher-Bold',
    fontSize: 13,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  controls: {
    position: 'absolute',
    top: 80,
    right: 20,
  },
  controlButton: {
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  serviceCount: {
    position: 'absolute',
    top: 80,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  serviceCountText: {
    fontSize: 14,
  },
  bottomInfo: {
    padding: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  subInfoText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  // Top Search Bar Styles (same as service.tsx)
  topSearchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  topSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#423120',
    width: 320,
    height: 46,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#423120',
    width: 320,
    height: 54,
    paddingLeft: 6,
    paddingRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeModeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#423120',
  },
  routeInfo: {
    flex: 1,
    marginLeft: 4,
  },
  routeInfoMain: {
    fontFamily: 'Philosopher-Bold',
    fontSize: 16,
    color: '#423120',
  },
  routeInfoSub: {
    fontFamily: 'Philosopher-Regular',
    fontSize: 12,
    color: '#8A7F75',
  },
  topSearchIcon: {
    marginRight: 12,
  },
  topSearchText: {
    flex: 1,
    fontSize: 16,
  },
  searchContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#423120',
    width: 320,
    height: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    width: 31,
    height: 31,
    marginRight: 12,
  },
  searchText: {
    fontSize: 23,
    fontFamily: 'Philosopher-Bold',
    flex: 1,
  },
  // Search Modal Styles
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#F4EDE5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#D7C3A7',
  },
  searchTitle: {
    fontSize: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#423120',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchButton: {
    padding: 8,
    marginLeft: 8,
  },
  searchActionContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchActionText: {
    fontSize: 18,
  },
  searchLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  searchLoadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  servicesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  serviceItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D7C3A7',
  },
  serviceName: {
    fontSize: 18,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Bottom Swipeable Cards Styles
  cardsContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  cardPhoto: {
    width: '100%',
    height: 118,
    backgroundColor: '#F4EDE5',
  },
  cardPhotoCount: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 49, 32, 0.75)',
  },
  cardPhotoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Philosopher-Bold',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Philosopher-Bold',
    color: '#423120',
  },
  cardRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#F4EDE5',
  },
  cardRatingText: {
    fontSize: 13,
    fontFamily: 'Philosopher-Bold',
    color: '#423120',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  cardInfoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Philosopher-Regular',
    color: '#423120',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cardButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardButtonOutline: {
    borderWidth: 1.5,
    borderColor: '#423120',
    backgroundColor: '#FFFFFF',
  },
  cardButtonFilled: {
    backgroundColor: '#423120',
  },
  cardButtonText: {
    fontSize: 15,
    fontFamily: 'Philosopher-Bold',
  },
  // Salon Detail Modal Styles
  salonDetailOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  salonDetailBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  salonDetailContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    minHeight: 400,
    paddingBottom: 40,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  salonDetailCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  salonDetailImageContainer: {
    width: '100%',
    height: 300,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  salonDetailImage: {
    width: '100%',
    height: '100%',
  },
  salonDetailImagePlaceholder: {
    backgroundColor: '#F4EDE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salonDetailInfo: {
    padding: 20,
  },
  salonDetailName: {
    fontSize: 28,
    marginBottom: 8,
  },
  salonDetailRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  salonDetailRating: {
    fontSize: 18,
    marginRight: 4,
  },
  salonDetailStar: {
    fontSize: 18,
    marginRight: 4,
  },
  salonDetailReviewCount: {
    fontSize: 16,
  },
  salonDetailIntro: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  salonDetailActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  salonDetailActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  salonDetailActionButtonPrimary: {
    backgroundColor: '#423120',
  },
  salonDetailActionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#423120',
  },
  salonDetailActionButtonText: {
    fontSize: 16,
  },
  salonDetailServicesButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salonDetailServicesButtonText: {
    fontSize: 18,
  },
});
