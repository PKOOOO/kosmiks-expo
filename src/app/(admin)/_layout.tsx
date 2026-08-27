import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const inactive = '#8b7b63';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: beige,
          borderTopWidth: 0,
          elevation: 0,
          height: 70,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: darkBrown,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontFamily: 'Philosopher-Bold',
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart" color={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="saloons"
        options={{
          title: 'Saloons',
          tabBarIcon: ({ color }) => (
            <Ionicons name="business" color={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color }) => (
            <Ionicons name="list" color={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color }) => (
            <Ionicons name="clipboard" color={color} size={26} />
          ),
        }}
      />
      {/* Users tab hidden from nav (route still accessible if needed) */}
      <Tabs.Screen
        name="users"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
