import React, { useEffect } from "react";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { initializeAuthToken, initializeApi } from "./src/api/api"; // Добавьте initializeApi
import { Alert } from "react-native";
import logger from "./src/utils/logger"; // импорт логгера

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
        initializeApi(); // Вызов инициализации интерсептора
        await checkUserStatus(); // Проверяем статус пользователя

        await initializeAuthToken();

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

  return <AppNavigator />;
};

export default App;
