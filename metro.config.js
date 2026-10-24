const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow .tflite pose models to be bundled as assets.
config.resolver.assetExts = [...config.resolver.assetExts, 'tflite'];

module.exports = withNativeWind(config, { input: './src/global.css' });
