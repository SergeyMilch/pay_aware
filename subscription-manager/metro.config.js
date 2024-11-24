const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  transformer: {
    ...defaultConfig.transformer,
    assetPlugins: ["expo-asset/tools/hashAssetFiles"],
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    ...defaultConfig.resolver,
    assetExts: [...defaultConfig.resolver.assetExts, "env"], // Чтобы распознавались `.env` файлы
  },
};
