import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { pendingAuthCallback } from '@/lib/auth-links';

export default function Index() {
  const { user, isLoading, isPasswordRecovery } = useAuth();
  if (isLoading) return null;
  if (pendingAuthCallback()) return <Redirect href="/auth/callback" />;
  if (isPasswordRecovery) return <Redirect href="/auth/reset-password" />;
  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)" />;
}
