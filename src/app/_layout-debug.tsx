import React from "react";
import { Slot } from "expo-router";
import { View, Text } from "react-native";

export default function Layout() {
  try {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <Text style={{ fontSize: 20, marginBottom: 20 }}>Debug Layout Working</Text>
        <Slot />
      </View>
    );
  } catch (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'red' }}>
        <Text style={{ color: 'white' }}>Layout Error: {String(error)}</Text>
      </View>
    );
  }
}