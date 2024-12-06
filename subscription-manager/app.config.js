export default {
  expo: {
    name: "subscription-manager",
    slug: "subscription-manager",
    version: "1.0.0",
    scheme: "payawareapp", // схема приложения, используется для deeplink
    newArchEnabled: true,
    platforms: ["ios", "android"],
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pushkin85.mil.subscriptionmanager",
    },
    android: {
      package: "com.pushkin85.mil.subscriptionmanager",
      enableHermes: true,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "https",
              host: "pay-aware.ru",
              pathPrefix: "/reset-password",
            },
            {
              scheme: "payawareapp", // добавляем кастомную схему приложения
              pathPrefix: "/reset-password",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK",
        "POST_NOTIFICATIONS",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "6e51137e-084d-4364-a90c-14f366df944e",
      },
    },
    plugins: ["expo-asset", "expo-secure-store"],
  },
};
