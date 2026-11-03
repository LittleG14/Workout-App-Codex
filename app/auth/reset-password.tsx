import React, { useRef, useState } from 'react';
import { router } from 'expo-router';
import { AuthButton, AuthField, AuthNotice, AuthPanel } from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordScreen() {
  const { isPasswordRecovery, resetPassword } = useAuth();
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    if (password !== confirm) { setNotice('Your passwords do not match.'); return; }
    saving.current = true; setBusy(true); setNotice('');
    try { await resetPassword(password); setPassword(''); setConfirm(''); router.replace('/(tabs)'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update the password. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <AuthPanel title="Choose a new password" message="Use at least 8 characters. Your Supabase project may require additional password strength.">
    {isPasswordRecovery ? <>
      <AuthField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!busy} />
      <AuthField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" editable={!busy} />
      <AuthButton label="Update password" busy={busy} onPress={() => { void save(); }} />
    </> : <AuthNotice>Open a valid reset link requested on this device to change your password. If you restarted during recovery, request a new link.</AuthNotice>}
    {notice ? <AuthNotice>{notice}</AuthNotice> : null}
    <AuthButton label="Request a new reset email" disabled={busy} onPress={() => router.replace('/auth/forgot-password')} />
  </AuthPanel>;
}
