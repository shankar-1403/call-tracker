const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer package.json "react-native" entry for Firebase Auth so the RN
// persistence build can resolve. Package exports often force the browser build.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
