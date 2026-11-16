import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertAccountScope, getAccountScope } from './account-scope';
import { equipmentRepository } from './equipment-service';
import type { EquipmentPreferences } from '../shared/equipment';

export function useEquipmentPreferences() {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ['equipment-preferences', user?.id ?? ''];
  const query = useQuery({ queryKey: key, queryFn: () => {
    const scope = getAccountScope();
    if (scope.userId !== user?.id) throw new Error('Your account changed. Please try again.');
    return equipmentRepository.load(scope);
  }, enabled: !!user,
    retry: false, staleTime: 0, refetchOnMount: 'always' });
  // Called on focus/menu open AND before every automatic selection, even if cached.
  const loadLatest = useCallback(async () => {
    const key = ['equipment-preferences', user?.id ?? ''];
    const scope = getAccountScope();
    if (scope.userId !== user?.id) throw new Error('Your account changed. Please try again.');
    try {
      const pref = await equipmentRepository.load(scope); assertAccountScope(scope);
      client.setQueryData(key, pref); return pref;
    } catch (error) {
      assertAccountScope(scope);
      // Do not let an older successful value authorize generation after an error.
      void client.invalidateQueries({ queryKey: key, refetchType: 'none' });
      throw error;
    }
  }, [client, user?.id]);
  const save = useCallback(async (pref: EquipmentPreferences) => {
    const key = ['equipment-preferences', user?.id ?? ''];
    const scope = getAccountScope();
    if (scope.userId !== user?.id) throw new Error('Your account changed. Please try again.');
    await client.cancelQueries({ queryKey: key }); assertAccountScope(scope);
    const saved = await equipmentRepository.save(pref, scope); assertAccountScope(scope);
    client.setQueryData(key, saved); return saved;
  }, [client, user?.id]);
  return { ...query, loadLatest, save };
}
