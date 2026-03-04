import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const data = await AsyncStorage.getItem(PROFILE_KEY);
  if (!data) return { ...DEFAULT_PROFILE };
  return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
