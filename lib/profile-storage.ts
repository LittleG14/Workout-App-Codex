import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountStorageKey, assertAccountScope, getAccountScope } from './account-scope';

const PROFILE_KEY = 'ironforge_profile';

export interface UserProfile {
  gender: 'not_applicable' | 'male' | 'female';
  heightFeet?: number;
  heightInches?: number;
  heightCm?: number;
  heightUnit: 'imperial' | 'metric';
  weight?: number;
  weightUnit: 'lbs' | 'kg';
  age?: number;
  goal: 'build_muscle' | 'lose_weight' | 'maintain_weight';
}

const DEFAULT_PROFILE: UserProfile = {
  gender: 'not_applicable',
  heightUnit: 'imperial',
  weightUnit: 'lbs',
  goal: 'build_muscle',
};

export async function getProfile(): Promise<UserProfile> {
  const scope = getAccountScope();
  const data = await AsyncStorage.getItem(accountStorageKey(scope, PROFILE_KEY));
  assertAccountScope(scope);
  if (!data) return { ...DEFAULT_PROFILE };
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch { throw new Error('Your saved profile could not be read. It has been preserved.'); }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const scope = getAccountScope();
  await AsyncStorage.setItem(accountStorageKey(scope, PROFILE_KEY), JSON.stringify(profile));
  assertAccountScope(scope);
}
