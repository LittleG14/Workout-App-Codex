const { withInfoPlist } = require('expo/config-plugins');

// SDK 54's automatic TaskManager plugin adds "fetch". This app defines a location
// task only; no fetch job is registered. Keep the location mode added by Location.
module.exports = config => withInfoPlist(config, config => {
  config.modResults.UIBackgroundModes = (config.modResults.UIBackgroundModes ?? []).filter(mode => mode !== 'fetch');
  return config;
});
