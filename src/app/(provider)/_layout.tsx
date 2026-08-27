import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const darkBrown = '#423120';
const beige = '#D7C3A7';
const inactive = '#8b7b63';

export default function ProviderLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: beige,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: darkBrown,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontFamily: 'Philosopher-Regular',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cut-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="salon"
        options={{
          title: 'Salon',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payouts"
        options={{
          title: 'Payouts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
