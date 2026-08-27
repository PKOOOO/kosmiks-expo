// src/app/(app)/_layout.tsx
import { Stack } from "expo-router";

function Layout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="info" />
            <Stack.Screen name="services" />
            <Stack.Screen name="saloons" />
            <Stack.Screen name="salon-sector" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="success" />
            <Stack.Screen name="cancel" />
            <Stack.Screen name="map" />
            <Stack.Screen name="bookings" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="profile-edit" />
            <Stack.Screen name="language" />
        </Stack>
    );
}

export default Layout;
