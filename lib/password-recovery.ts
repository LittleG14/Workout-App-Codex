export interface RecoverySession { user: { id: string }; expires_at?: number; access_token: string }
type Session = RecoverySession;
interface Auth {
  exchangeCodeForSession(code: string): Promise<{ data: { session: Session | null; redirectType?: string | null }; error: unknown }>;
  getSession(): Promise<{ data: { session: Session | null }; error?: unknown }>;
  updatePassword(session: Session, password: string): Promise<{ error: unknown }>;
}
/** Recovery authority comes from Supabase + the secure PKCE verifier, never URL `type`. */
export function createPasswordRecovery(auth: Auth, now = Date.now) {
  let grant: { userId: string; until: number } | null = null;
  let previous: { code: string; result: Promise<boolean> } | null = null;
  return {
    accept(code: string): Promise<boolean> {
      if (previous?.code === code) return previous.result;
      const result = (async () => {
        grant = null;
        const { data, error } = await auth.exchangeCodeForSession(code);
        if (error || !data.session) throw new Error('This link is invalid or expired. Request a new email from this device.');
        const current = await auth.getSession();
        if (current.error || current.data.session?.user.id !== data.session.user.id) throw new Error('Your account changed. Please request a new link.');
        const recovery = data.redirectType === 'PASSWORD_RECOVERY';
        if (recovery) grant = { userId: data.session.user.id, until: Math.min(now() + 10 * 60 * 1000, (data.session.expires_at ?? 0) * 1000) };
        return recovery;
      })();
      previous = { code, result }; return result;
    },
    authorized(userId?: string) { return !!grant && grant.until > now() && grant.userId === userId; },
    clear() { grant = null; },
    async update(password: string) {
      if (password.length < 8) throw new Error('Use at least 8 characters for your new password.');
      const permit = grant;
      const { data, error } = await auth.getSession();
      if (!permit || grant !== permit || permit.until <= now() || error || data.session?.user.id !== permit.userId
        || (data.session.expires_at ?? 0) * 1000 <= now()) throw new Error('Recovery has expired or your account changed. Request a new reset email.');
      // Bind the write to this verified session's token. Re-reading a mutable SDK
      // session inside updateUser could target a newly signed-in account instead.
      const result = await auth.updatePassword(data.session, password);
      if (result.error) throw new Error('The password could not be updated. Check your connection and password requirements, then try again.');
      grant = null;
    },
  };
}
