const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D win-screen models (see components/Model3D.js) are shipped as .glb —
// Metro needs to treat these as binary assets (like images), same as any
// other require()'d file, or it will try to parse them as source.
config.resolver.assetExts.push('glb', 'gltf', 'bin');

// Keep Metro from crawling native build output (android/ is >1GB). A slow
// initial crawl lets bundle requests race Metro's file-map init, which shows
// up as "Cannot read properties of undefined (reading 'get')" in
// DependencyGraph.js.
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[\\/]android[\\/](build|\.gradle|\.cxx|app[\\/]build|app[\\/]\.cxx)[\\/].*/,
  /[\\/]ios[\\/](build|Pods)[\\/].*/,
];

module.exports = config;
