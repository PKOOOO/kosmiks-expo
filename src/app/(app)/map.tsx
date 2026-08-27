import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Image, Dimensions, Linking } from 'react-native';
import { useFonts } from 'expo-font';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from 'expo-location';
import { WebView } from "react-native-webview";
import Header from "../components/Header";
import SideMenu from "../components/SideMenu";
import getSaloonsMap from "../actions/get-saloons-map";
import getServices from "../actions/get-services";
import { Saloon, Service } from "../types";
import { MAPBOX_TOKEN, hasMapboxToken, MAP_UNAVAILABLE_HTML } from "@/config/constants";

// Extended interface for map salon data
interface MapSalon extends Saloon {
  latitude: number;
  longitude: number;
  averageRating: number;
  reviewCount: number;
}


export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [salons, setSalons] = useState<MapSalon[]>([]);
  const [salonsLoading, setSalonsLoading] = useState(false);
  const [selectedSalon, setSelectedSalon] = useState<MapSalon | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isSalonDetailVisible, setSalonDetailVisible] = useState(false);
  const [selectedSalonForDetail, setSelectedSalonForDetail] = useState<MapSalon | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [filteredSalons, setFilteredSalons] = useState<MapSalon[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [displayedSalons, setDisplayedSalons] = useState<MapSalon[]>([]); // Salons to display in cards
  const [webViewRef, setWebViewRef] = useState<WebView | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
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

  const fetchSalons = async () => {
    try {
      setSalonsLoading(true);
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
      console.error('Error fetching salons from API:', error);
      // On failure, show an empty map rather than fake pins.
      setSalons([]);
      setDisplayedSalons([]);
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
    if (selectedSalon && salons.length > 0) {
      const index = salons.findIndex(s => s.id === selectedSalon.id);
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
  }, [selectedSalon?.id, salons.length]);

  const onMarkerPress = (salon: MapSalon) => {
    setSelectedSalon(salon);
    const services = salon.saloonServices.map(s => s.service.name).join(', ');
    Alert.alert(
      salon.name,
      `Palvelut: ${services}\nArvio: ${salon.averageRating.toFixed(1)}/5 (${salon.reviewCount} arvostelua)\nOsoite: ${salon.address || 'Ei määritelty'}`,
      [
        { text: 'Peruuta', style: 'cancel' },
        { text: 'Varaa aika', onPress: () => router.push('/bookings') },
      ]
    );
  };

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

  // Just center the map on salon (used by search button)
  const centerMapOnSalon = (salon: MapSalon) => {
    if (webViewRef) {
      const message = JSON.stringify({
        type: 'centerOnLocation',
        latitude: salon.latitude,
        longitude: salon.longitude,
      });
      webViewRef.postMessage(message);
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

  // Handle directions button
  const handleDirections = (salon: MapSalon) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${salon.latitude},${salon.longitude}`,
      android: `google.navigation:q=${salon.latitude},${salon.longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to web maps
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${salon.latitude},${salon.longitude}`;
        Linking.openURL(webUrl);
      });
    }
  };

  // Handle call button
  const handleCall = (salon: MapSalon) => {
    // Check if salon has phone number - for now, show alert
    // You can add phone field to MapSalon interface if available
    Alert.alert(
      'Puhelin',
      'Puhelinnumero ei ole saatavilla tälle salonille.',
      [{ text: 'OK' }]
    );
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
    const normalize = (s: string) => (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    const q = normalize(query);
    if (q.length === 0) {
      // Show all salons when search is empty
      setDisplayedSalons(salons);
      setFilteredSalons([]);
      return;
    }
    // Only filter salons by name
    const filtered = salons.filter((salon) => {
      const name = normalize(salon.name);
      return name.includes(q);
    });
    setDisplayedSalons(filtered);
    setFilteredSalons(filtered);
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

    const markers = salons.map(salon => ({
      id: salon.id,
      name: salon.name,
      lat: salon.latitude,
      lng: salon.longitude,
      rating: salon.averageRating,
      reviewCount: salon.reviewCount,
      services: salon.saloonServices.map(s => s.service.name).join(', '),
      address: salon.address || 'Ei määritelty'
    }));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Map</title>
        <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
        <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
          a { pointer-events: none; }
          * { -webkit-touch-callout: none; -webkit-user-select: none; }
          .mapboxgl-popup-content {
            border-radius: 12px;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .popup-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 8px;
            color: #423120;
          }
          .popup-details {
            font-size: 14px;
            color: #666;
            margin-bottom: 4px;
          }
          .popup-button {
            background-color: #D7C3A7;
            color: #423120;
            border: 2px solid #423120;
            padding: 12px 16px;
            border-radius: 8px;
            margin-top: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s ease;
          }
          .popup-button:hover {
            background-color: #423120;
            color: #D7C3A7;
          }
          .salon-marker {
            font-size: 30px;
            cursor: pointer;
            position: relative;
            overflow: visible;
          }
          .salon-label {
            pointer-events: none;
            user-select: none;
            
            padding: 6px 10px;
            border-radius: 15px;
            font-size: 20px;
            font-weight: bold;
            color: #423120;
            white-space: nowrap;
            max-width: 100px;
            text-align: center;
            
            
            margin-bottom: 2px;
          }
          .salon-marker-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            /* Ensure no weird positioning interferes */
            transform: translate(-50%, -100%); /* Adjust visual centering if needed, but Mapbox handles anchor */
          }
        </style>
      </head>
      <body>
        <div id='map'></div>
        <script>
          mapboxgl.accessToken = '${MAPBOX_TOKEN}';
          
          const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [${centerLng}, ${centerLat}],
            zoom: 13,
            projection: { name: 'mercator' }
          });

          // Prevent any default link behavior
          document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);

          // Add user location marker
          ${userLocation ? `
          new mapboxgl.Marker({ color: '#007AFF' })
            .setLngLat([${userLocation.longitude}, ${userLocation.latitude}])
            .setPopup(new mapboxgl.Popup().setHTML('<div class="popup-title">Sinun sijaintisi</div>'))
            .addTo(map);
          ` : ''}

          // Add salon markers
          const markers = ${JSON.stringify(markers)};
          
          markers.forEach(salon => {
            // Ensure numeric coordinates
            const lat = parseFloat(salon.lat);
            const lng = parseFloat(salon.lng);
            
            if (isNaN(lat) || isNaN(lng)) return;

            // Simple container
            const container = document.createElement('div');
            container.className = 'salon-marker-container';
            
            // Label
            const labelEl = document.createElement('div');
            labelEl.className = 'salon-label';
            labelEl.innerHTML = salon.name; // + ' (' + lat.toFixed(2) + ')'; // Debug info removed for cleanliness
            
            // Icon
            const el = document.createElement('div');
            el.className = 'salon-marker';
            el.innerHTML = '✂️';
            
            container.appendChild(labelEl);
            container.appendChild(el);
            
            // Create marker
            new mapboxgl.Marker({
              element: container,
              anchor: 'bottom'
            })
            .setLngLat([lng, lat])
            .addTo(map);
          });

          // Listen for messages from React Native
          window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'centerOnLocation') {
              map.flyTo({
                center: [data.longitude, data.latitude],
                zoom: 15,
                duration: 2000,
                padding: { bottom: 450 }
              });
            } else if (data.type === 'zoomToService') {
              // Zoom to salons offering a specific service
              map.flyTo({
                center: [data.center.longitude, data.center.latitude],
                zoom: 14,
                duration: 2000,
                padding: { bottom: 450 }
              });
              
              // Show a popup with service info
              setTimeout(() => {
                const popup = new mapboxgl.Popup({ 
                  closeButton: true,
                  closeOnClick: false,
                  offset: 25
                })
                .setLngLat([data.center.longitude, data.center.latitude])
                .setHTML(
                  '<div class="popup-title">' + data.serviceName + '</div>' +
                  '<div class="popup-details">Löytyi ' + data.salons.length + ' salon tällä palvelulla</div>' +
                  '<div class="popup-details">Salonit: ' + data.salons.map(s => s.name).join(', ') + '</div>'
                )
                .addTo(map);
              }, 2000);
            }
          });

          // Handle WebView messages
          document.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'centerOnLocation') {
              map.flyTo({
                center: [data.longitude, data.latitude],
                zoom: 15,
                duration: 2000,
                padding: { bottom: 450 }
              });
            } else if (data.type === 'zoomToService') {
              // Zoom to salons offering a specific service
              map.flyTo({
                center: [data.center.longitude, data.center.latitude],
                zoom: 14,
                duration: 2000,
                padding: { bottom: 450 }
              });
              
              // Show a popup with service info
              setTimeout(() => {
                const popup = new mapboxgl.Popup({ 
                  closeButton: true,
                  closeOnClick: false,
                  offset: 25
                })
                .setLngLat([data.center.longitude, data.center.latitude])
                .setHTML(
                  '<div class="popup-title">' + data.serviceName + '</div>' +
                  '<div class="popup-details">Löytyi ' + data.salons.length + ' salon tällä palvelulla</div>' +
                  '<div class="popup-details">Salonit: ' + data.salons.map(s => s.name).join(', ') + '</div>'
                )
                .addTo(map);
              }, 2000);
            }
          });
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
      } else if (data.type === 'bookAppointment') {
        // Handle booking appointment
        const salon = salons.find(s => s.id === data.salonId);
        if (salon) {
          onMarkerPress(salon);
        }
      } else if (data.type === 'salonSelected') {
        // Legacy support
        const salon = salons.find(s => s.id === data.salonId);
        if (salon) {
          onMarkerPress(salon);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

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
      {/* Servey Header */}
      <Header
        title="SERVEY"
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

        {/* Search Bar - Now floating at the bottom */}
        <KeyboardAvoidingView
          behavior="padding"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 20}
        >
          <View style={[styles.topSearchContainer, { paddingBottom: Platform.OS === 'ios' ? 55 + insets.bottom : 85 + insets.bottom }]}>
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
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Empty state — clean map, no fake pins, when there are no salons yet */}
        {!salonsLoading && displayedSalons.length === 0 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', bottom: 32, left: 24, right: 24,
              backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14,
              paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
            }}
          >
            <Ionicons name="location-outline" size={22} color="#423120" style={{ marginBottom: 6 }} />
            <Text style={{ fontFamily: 'Philosopher-Bold', fontSize: 15, color: '#423120' }}>
              No salons available yet
            </Text>
            <Text style={{ fontFamily: 'Philosopher-Regular', fontSize: 13, color: '#888', marginTop: 2, textAlign: 'center' }}>
              Check back soon — new salons appear here as they join.
            </Text>
          </View>
        )}

        {/* Bottom Swipeable Cards */}
        {displayedSalons.length > 0 && (
          <View style={[styles.cardsContainer, { top: 10 }]}>
            <FlatList
              ref={cardsFlatListRef}
              data={displayedSalons}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled={false}
              // One-swipe-per-card snapping
              snapToInterval={Dimensions.get('window').width - 30} // cardWidth (W-50) + marginRight (20)
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.cardsContentContainer}
              scrollEnabled={true}
              bounces={false}
              getItemLayout={(data, index) => {
                const length = Dimensions.get('window').width - 30; // must match snapToInterval
                const offset = 20 + index * length; // left padding 20 + index * itemLength
                return { length, offset, index };
              }}
              onViewableItemsChanged={({ viewableItems }) => {
                if (viewableItems.length > 0 && viewableItems[0].index !== null) {
                  const index = viewableItems[0].index;
                  const salon = displayedSalons[index];
                  setActiveCardIndex(index);
                  setSelectedSalon(salon);
                  // Move map camera to the active card's salon
                  centerMapOnSalon(salon);
                }
              }}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 50,
              }}
              renderItem={({ item: salon, index }) => (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => handleSalonCardPress(salon)}
                >
                  {/* Thumbnail Image */}
                  <Image
                    source={{
                      uri: salon.images && salon.images.length > 0
                        ? salon.images[0].url
                        : 'https://via.placeholder.com/80x80?text=No+Image'
                    }}
                    style={styles.cardThumbnail}
                    resizeMode="cover"
                  />

                  {/* Card Content */}
                  <View style={styles.cardContent}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {salon.name}
                    </Text>

                    {/* Rating Row */}
                    <View style={styles.cardRatingRow}>
                      <Text style={styles.cardRating}>
                        {salon.averageRating ? salon.averageRating.toFixed(1) : salon.rating?.toFixed(1) || '0.0'}
                      </Text>
                      <Text style={styles.cardStar}>⭐ • Salonki</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
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
                    <Image
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
                    <Text style={[styles.salonDetailRating, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                      {selectedSalonForDetail.averageRating ? selectedSalonForDetail.averageRating.toFixed(1) : selectedSalonForDetail.rating?.toFixed(1) || '0.0'}
                    </Text>
                    <Text style={[styles.salonDetailStar, { color: darkBrown }]}>
                      ⭐
                    </Text>
                    <Text style={[styles.salonDetailReviewCount, { color: '#666', fontFamily: 'Philosopher-Regular' }]}>
                      • {selectedSalonForDetail.reviewCount || 0} arvostelua
                    </Text>
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

                    {/* Call Button */}
                    <TouchableOpacity
                      style={[styles.salonDetailActionButton, styles.salonDetailActionButtonSecondary]}
                      onPress={() => handleCall(selectedSalonForDetail)}
                    >
                      <Ionicons name="call" size={20} color={darkBrown} />
                      <Text style={[styles.salonDetailActionButtonText, { color: darkBrown, fontFamily: 'Philosopher-Bold' }]}>
                        Soita
                      </Text>
                    </TouchableOpacity>
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
  cardsContainer: {
    position: 'absolute',
    top: 10, // Position at the top of the map
    left: 0,
    right: 0,
    height: 120,
  },
  cardsContentContainer: {
    paddingLeft: 20,
    paddingRight: 20, // Standard padding, will be adjusted per card
  },
  card: {
    width: Dimensions.get('window').width - 50, // Smaller width to show peek of next card (reduced peek)
    height: 90,
    backgroundColor: '#D7C3A7',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#423120',
  },
  cardThumbnail: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#F4EDE5',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 18,
    fontFamily: 'Philosopher-Bold',
    color: '#423120',
    marginBottom: 6,
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align rating number and star on the same baseline
  },
  cardRating: {
    fontSize: 16,
    fontFamily: 'Philosopher-Bold',
    color: '#423120',
    marginRight: 4,
  },
  cardStar: {
    fontSize: 16,
    color: '#423120',
    fontFamily: 'Philosopher-Bold',
    marginBottom: 1, // Tiny adjustment so the star visually lines up with the number
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