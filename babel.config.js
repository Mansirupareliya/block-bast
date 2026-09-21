// Added for react-native-reanimated 4 (a peer dependency of expo-gl, used
// here to render 3D trophy/win models). Reanimated 4 requires the Worklets
// Babel plugin, and it must be listed last.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
