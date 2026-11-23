const { withInfoPlist } = require('expo/config-plugins');

// SDK 54's automatic TaskManager plugin adds "fetch". This app defines a location
// task only; no fetch job is registered. Brief milestone audio uses its own scoped
// AVAudioSession while the existing location task supplies GPS events.
module.exports = config => withInfoPlist(config, config => {
  config.modResults.UIBackgroundModes = [...new Set([...(config.modResults.UIBackgroundModes ?? []).filter(mode => mode !== 'fetch'), 'audio'])];
  return config;
});
