import '@/lib/run-tracking';
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StartupFailure } from '@/components/StartupFailure';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="workout/[id]"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}

function RootLayoutContent({ fontsLoaded, fontError, retry }: { fontsLoaded: boolean; fontError: Error | null; retry: () => void }) {
  const { isLoading, user, startupError } = useAuth();
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  const failure = startupError ?? (fontError || (fontTimedOut && !fontsLoaded) ? 'The app’s fonts could not load. Please try again.' : null);

  useEffect(() => {
    if (failure || (fontsLoaded && !isLoading)) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isLoading, failure]);

  if (failure) return <StartupFailure message={failure} retry={retry} />;
  if (!fontsLoaded || isLoading) return null;

  return <RootLayoutNav key={user?.id ?? 'signed-out'} />;
}

function StartupAttempt({ retry }: { retry: () => void }) {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <RootLayoutContent fontsLoaded={fontsLoaded} fontError={fontError} retry={retry} />
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  const [attempt, setAttempt] = useState(0);
  return <StartupAttempt key={attempt} retry={() => setAttempt(value => value + 1)} />;
}
