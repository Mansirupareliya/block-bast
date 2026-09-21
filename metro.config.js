const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D win-screen models (see components/Model3D.js) are shipped as .glb —
// Metro needs to treat these as binary assets (like images), same as any
// other require()'d file, or it will try to parse them as source.
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
