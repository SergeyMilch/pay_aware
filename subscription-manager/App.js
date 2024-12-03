import React, { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import {
  initializeAuthToken,
  initializeApi,
  getUserById,
  isTokenExpired,
} from "./src/api/api";
import { Alert, View, Text } from "react-native";
import logger from "./src/utils/logger";
import { registerForPushNotificationsAsync } from "./src/utils/notifications";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking"; // Добавлен импорт Linking

// Подавление глобальных ошибок в Expo
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      logger.error("Произошла фатальная ошибка:", error);
      Alert.alert(
        "Ошибка",
        "Произошла непредвиденная ошибка. Пожалуйста, перезапустите приложение."
      );
    } else {
      logger.error("Произошла ошибка:", error);
    }
    defaultHandler(error, isFatal);
  });
}

const App = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Инициализация API
        try {
          initializeApi();
        } catch (error) {
          logger.error("Ошибка при инициализации API:", error);
        }

        // Проверка глубоких ссылок (URL для сброса пароля)
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const data = Linking.parse(initialUrl);
          if (data.path === "reset-password" && data.queryParams?.token) {
            logger.log(
              "Приложение открыто через глубокую ссылку для сброса пароля"
            );
            setInitialRoute({
              name: "ResetPasswordScreen",
              params: { token: data.queryParams.token },
            });
            setIsInitializing(false);
            return;
          }
        }

        // Проверка статуса пользователя
        await initializeAuthToken();
        const token = await SecureStore.getItemAsync("authToken");
        const userId = await SecureStore.getItemAsync("userId");

        if (token && userId) {
          if (isTokenExpired(token)) {
            logger.warn("JWT токен истек, перенаправляем на экран логина");
            setInitialRoute("Login");
          } else {
            const user = await getUserById(userId);
            if (user) {
              setInitialRoute("SubscriptionList");
            } else {
              logger.warn(
                "Пользователь не найден, перенаправляем на регистрацию"
              );
              setInitialRoute("Register");
            }
          }
        } else {
          logger.warn(
            "Токен или userId отсутствуют, перенаправляем на регистрацию"
          );
          setInitialRoute("Register");
        }

        // Регистрация push-уведомлений
        const deviceToken = await registerForPushNotificationsAsync();
        if (deviceToken) {
          logger.log("Токен устройства успешно зарегистрирован:", deviceToken);
        }

        // Установка обработчика уведомлений
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      } catch (error) {
        logger.error("Ошибка при инициализации приложения:", error);
        setInitialRoute("Register");
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();

    // Listener для получения уведомлений, даже когда приложение активно
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.log("Notification Received:", notification);
        Alert.alert(
          notification.request.content.title || "Уведомление",
          notification.request.content.body || "У вас новое уведомление"
        );
      }
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        logger.log("Notification Response:", response);
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Проверка разрешений на уведомления
  useEffect(() => {
    const getPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Уведомления не разрешены",
          "Пожалуйста, включите уведомления в настройках."
        );
      }
    };

    getPermissions();
  }, []);

  if (isInitializing || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return <AppNavigator initialRoute={initialRoute} />;
};

export default App;
