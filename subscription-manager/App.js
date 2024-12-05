import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar"; // Импортируем компонент StatusBar
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { initializeApi, checkTokenAndNavigate } from "./src/api/api";
import { Alert, View, Text, AppState } from "react-native";
import logger from "./src/utils/logger";
import { registerForPushNotificationsAsync } from "./src/utils/notifications";
import * as Linking from "expo-linking"; // Импортируем Linking для работы с глубокими ссылками
import crashlytics from "@react-native-firebase/crashlytics"; // Импортируем Crashlytics

// Подавление глобальных ошибок в Expo
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const errorMessage = isFatal
      ? `Фатальная ошибка: ${error.message}\n${error.stack}`
      : `Ошибка: ${error.message}\n${error.stack}`;

    // Отправляем лог в Crashlytics
    crashlytics().log(errorMessage);

    // Сообщаем о сбое в Crashlytics
    crashlytics().recordError(error);

    if (isFatal) {
      logger.error("Произошла фатальная ошибка:", error);
      Alert.alert(
        "Ошибка",
        "Произошла непредвиденная ошибка. Пожалуйста, перезапустите приложение."
      );
    } else {
      logger.error("Произошла ошибка:", error);
    }

    // Вызываем стандартный обработчик ошибок
    defaultHandler(error, isFatal);
  });
}

const App = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.log("Начало инициализации приложения");

        // Инициализация API
        initializeApi();
        logger.log("API успешно инициализирован");

        // Проверка токена и навигация
        await checkTokenAndNavigate(setInitialRoute);

        // Регистрация push-уведомлений
        logger.log("Начало регистрации push-уведомлений");
        const deviceToken = await registerForPushNotificationsAsync();
        if (deviceToken) {
          logger.log("Токен устройства успешно зарегистрирован:", deviceToken);
        } else {
          logger.warn(
            "Не удалось зарегистрировать токен устройства для push-уведомлений"
          );
        }

        // Установка обработчика уведомлений
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        logger.log("Инициализация приложения завершена успешно");
      } catch (error) {
        logger.error("Ошибка при инициализации приложения:", error);
        crashlytics().recordError(error);
        setInitialRoute("Register");
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();

    // Listener для получения уведомлений, даже когда приложение активно
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.log("Уведомление получено:", notification);
        Alert.alert(
          notification.request.content.title || "Уведомление",
          notification.request.content.body || "У вас новое уведомление"
        );
      }
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        logger.log("Ответ на уведомление получен:", response);
      });

    // Добавление слушателя для глубоких ссылок, когда приложение уже открыто
    const handleDeepLink = (event) => {
      try {
        logger.log("Получена глубокая ссылка:", event.url);
        const data = Linking.parse(event.url);
        logger.log("Распознанные данные из ссылки:", data);

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
      } catch (error) {
        logger.error("Ошибка при обработке глубокой ссылки:", error);
        crashlytics().recordError(error);
      }
    };

    const linkingListener = Linking.addEventListener("url", handleDeepLink);

    // Добавление слушателя для изменения состояния приложения
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === "active") {
        logger.log("Приложение вернулось на передний план. Проверяем токен.");
        checkTokenAndNavigate(setInitialRoute);
      }
    };

    AppState.addEventListener("change", handleAppStateChange);

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
      linkingListener.remove();
      AppState.removeEventListener("change", handleAppStateChange);
    };
  }, []);

  // Добавляем setInterval для проверки токена каждые 15 минут (900000 миллисекунд)
  useEffect(() => {
    const intervalId = setInterval(() => {
      logger.log("Периодическая проверка токена...");
      checkTokenAndNavigate(setInitialRoute);
    }, 900000); // 15 минут

    // Очистка при размонтировании компонента
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Проверка разрешений на уведомления
  useEffect(() => {
    const getPermissions = async () => {
      logger.log("Запрос разрешений на отправку уведомлений");
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        logger.warn("Уведомления не разрешены пользователем");
        Alert.alert(
          "Уведомления не разрешены",
          "Пожалуйста, включите уведомления в настройках."
        );
      } else {
        logger.log("Разрешения на уведомления получены");
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
