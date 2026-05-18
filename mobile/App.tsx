import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { initializeDatabase } from "./src/db/database";
import type { RootStackParamList } from "./src/navigation/types";
import { CameraScreen } from "./src/screens/CameraScreen";
import { CategoryDetailScreen } from "./src/screens/CategoryDetailScreen";
import { SelectSiteScreen } from "./src/screens/SelectSiteScreen";
import { SiteDetailScreen } from "./src/screens/SiteDetailScreen";
import { PhotoSyncProvider } from "./src/sync/PhotoSyncContext";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => setIsReady(true))
      .catch((error: unknown) => {
        setStartupError(error instanceof Error ? error.message : "Unable to initialize local database.");
      });
  }, []);

  if (startupError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>Startup failed</Text>
        <Text style={styles.error}>{startupError}</Text>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Preparing offline storage...</Text>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <PhotoSyncProvider enabled={isReady}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="SelectSite"
            screenOptions={{
              headerStyle: { backgroundColor: "#ffffff" },
              headerTintColor: "#111827",
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: "#f4f6f8" },
            }}
          >
            <Stack.Screen name="SelectSite" component={SelectSiteScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SiteDetail" component={SiteDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ title: "Capture Photo", headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PhotoSyncProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f4f6f8",
    padding: 24,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  muted: {
    color: "#64748b",
  },
  error: {
    color: "#991b1b",
    textAlign: "center",
  },
});
