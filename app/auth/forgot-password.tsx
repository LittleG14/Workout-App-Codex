import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AuthButton, AuthField, AuthNotice, AuthPanel } from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const sending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const send = async () => {
    if (sending.current) return;
    sending.current = true; setBusy(true); setNotice('');
    try {
      await requestPasswordReset(email);
      if (mounted.current) setNotice('If an account exists for that email, you will receive a reset link. Open it on this same device or browser. Requesting another link replaces the previous request.');
    } catch (error) { if (mounted.current) setNotice(error instanceof Error ? error.message : 'Could not send the email. Please try again.'); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  return <AuthPanel title="Reset your password" message="Enter your account email to request a password reset link.">
    <AuthField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" editable={!busy} />
    {notice ? <AuthNotice>{notice}</AuthNotice> : null}
    <AuthButton label="Send reset email" busy={busy} onPress={() => { void send(); }} />
    <AuthButton label="Back to sign in" disabled={busy} onPress={() => router.replace('/(auth)')} />
  </AuthPanel>;
}
