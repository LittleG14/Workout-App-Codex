import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('EAS_PROJECT_ID must be the actual Expo project UUID.');
  return {
    ...config,
    name: config.name ?? 'Swole House', slug: config.slug ?? 'swole-house',
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
  };
};
