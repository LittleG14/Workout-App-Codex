import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getAccountScope } from '@/lib/account-scope';
import { circuitController } from '@/lib/circuit-runtime';

/** One foreground pulse for the whole account, independent of detail navigation. */
export function CircuitRuntime() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    void circuitController.activate(userId ? getAccountScope() : null);
    const pulse = setInterval(() => { if (AppState.currentState === 'active') void circuitController.tick(); }, 250);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' || state === 'background') void circuitController.setForeground(state === 'active');
    });
    return () => { clearInterval(pulse); subscription.remove(); void circuitController.activate(null); };
  }, [userId]);
  return null;
}
