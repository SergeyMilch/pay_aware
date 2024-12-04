import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar"; // Импортируем компонент StatusBar
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
import * as Linking from "expo-linking"; // Импортируем Linking для работы с глубокими ссылками

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
        initializeApi();

        // Проверка статуса пользователя
        await initializeAuthToken();
        const token = await SecureStore.getItemAsync("authToken");
        const userId = await SecureStore.getItemAsync("userId");

        if (token && userId) {
          if (isTokenExpired(token)) {
            // Если токен истек, перенаправляем на экран логина
            logger.warn("JWT токен истек, перенаправляем на экран логина");
            setInitialRoute("Login");
          } else {
            // Если токен действителен, проверяем наличие пользователя
            const user = await getUserById(userId);
            if (user) {
              // Пользователь найден, переходим на экран списка подписок
              setInitialRoute("SubscriptionList");
            } else {
              // Если пользователь не найден, перенаправляем на регистрацию
              logger.warn(
                "Пользователь не найден, перенаправляем на регистрацию"
              );
              setInitialRoute("Register");
            }
          }
        } else if (userId) {
          // Если токен отсутствует, но userId существует, перенаправляем на логин
          logger.warn("Токен отсутствует, перенаправляем на экран логина");
          setInitialRoute("Login");
        } else {
          // Если нет токена и userId, перенаправляем на регистрацию
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

    // Добавление слушателя для глубоких ссылок, когда приложение уже открыто
    const handleDeepLink = (event) => {
      const data = Linking.parse(event.url);
      const cleanPath = data.path.startsWith("/")
        ? data.path.substring(1)
        : data.path;
      if (cleanPath === "reset-password") {
        if (data.queryParams?.token) {
          logger.log(
            "Получена глубокая ссылка для сброса пароля после открытия"
          );
          setInitialRoute({
            name: "ResetPasswordScreen",
            params: { token: data.queryParams.token },
          });
        } else {
          logger.error("Ошибка: Токен отсутствует в параметрах запроса");
          Alert.alert(
            "Ошибка",
            "Некорректная ссылка для сброса пароля. Попробуйте снова."
          );
        }
      }
    };

    const linkingListener = Linking.addEventListener("url", handleDeepLink);

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);

      linkingListener.remove();
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

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <AppNavigator initialRoute={initialRoute} />
    </View>
  );
};

export default App;
