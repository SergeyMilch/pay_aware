import React, { useEffect } from "react";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { checkUserStatus } from "./src/navigation/AppNavigator";
import { initializeAuthToken, initializeApi } from "./src/api/api"; // initializeApi
import { Alert } from "react-native";
import logger from "./src/utils/logger"; // импорт логгера
import { registerForPushNotificationsAsync } from "./src/utils/notifications";

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
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Инициализация API
        try {
          initializeApi();
        } catch (error) {
          logger.error("Ошибка при инициализации API:", error);
        }

        // Проверка статуса пользователя
        try {
          await checkUserStatus(); // await, чтобы дождаться завершения
        } catch (error) {
          logger.error("Ошибка при проверке статуса пользователя:", error);
        }

        // Инициализация токена авторизации
        try {
          initializeAuthToken();
        } catch (error) {
          logger.error("Ошибка при инициализации токена авторизации:", error);
        }

        // Регистрация push-уведомлений
        try {
          const deviceToken = await registerForPushNotificationsAsync();
          if (deviceToken) {
            logger.log(
              "Токен устройства успешно зарегистрирован:",
              deviceToken
            );
          }
        } catch (error) {
          logger.error("Ошибка при регистрации токена устройства:", error);
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
  const getPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Уведомления не разрешены",
        "Пожалуйста, включите уведомления в настройках."
      );
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  return <AppNavigator />;
};

export default App;
