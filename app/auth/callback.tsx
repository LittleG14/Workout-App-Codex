import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthButton, AuthNotice, AuthPanel } from '@/components/AuthForm';
import { captureAuthCallback, clearAuthCallback, pendingAuthCallback } from '@/lib/auth-links';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackScreen() {
  const { processAuthCallback } = useAuth();
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === 'web' && !pendingAuthCallback()) {
      captureAuthCallback(window.location.href, window.location.origin);
      window.history.replaceState(null, '', '/auth/callback');
    }
    const callback = pendingAuthCallback();
    if (!callback || 'error' in callback) { clearAuthCallback(); setError('This link is invalid or expired. Request a new email on this device.'); return; }
    void processAuthCallback(callback.code).then(recovering => {
      if (!mounted) return;
      clearAuthCallback(); router.replace(recovering ? '/auth/reset-password' : '/(tabs)');
    }).catch(() => {
      if (mounted) { clearAuthCallback(); setError('We could not verify this link. It may be expired, already used, or requested on a different device. Request a new email here.'); }
    });
    return () => { mounted = false; };
  }, [processAuthCallback]);
  return <AuthPanel title={error ? 'Link needs attention' : 'Verifying your link'} message="Your account link is verified securely before continuing.">
    {error ? <><AuthNotice>{error}</AuthNotice><AuthButton label="Request a new reset email" onPress={() => router.replace('/auth/forgot-password')} /><AuthButton label="Back to sign in" onPress={() => router.replace('/(auth)')} /></> : <AuthNotice>Please wait…</AuthNotice>}
  </AuthPanel>;
}
