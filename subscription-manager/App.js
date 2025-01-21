import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import {
  initializeApi,
  checkTokenAndNavigate,
  initializeAuthToken,
} from "./src/api/api";
import { Alert, View, Text, AppState, Platform } from "react-native";
import logger from "./src/utils/logger";
import { registerForPushNotificationsAsync } from "./src/utils/notifications";
import * as Linking from "expo-linking";
import { navigationRef } from "./src/navigation/navigationService";
import { Provider as PaperProvider } from "react-native-paper";

const App = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [deepLinkParams, setDeepLinkParams] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.log("Начало инициализации приложения");

        // Инициализация API
        initializeApi();
        logger.log("API успешно инициализирован");

        // Устанавливаем токен из SecureStore
        await initializeAuthToken();

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

        // Создаём/обновляем канал на Android
        await createVibrationChannel();

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

        // Проверка, если путь или хост являются "reset-password"
        if (
          data?.path === "reset-password" ||
          data?.hostname === "reset-password"
        ) {
          if (data.queryParams?.token) {
            logger.log(
              "Получена глубокая ссылка для сброса пароля после открытия"
            );

            // Сохраняем параметры для дальнейшей навигации
            setDeepLinkParams({
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
        } else {
          logger.warn("Неизвестный путь в глубокой ссылке:", data.path);
        }
      } catch (error) {
        logger.error("Ошибка при обработке глубокой ссылки:", error);
        Alert.alert("Ошибка", "Произошла ошибка при обработке ссылки.");
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

    const appStateListener = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
      linkingListener.remove();
      appStateListener.remove(); // Удаление обработчика состояния приложения
    };
  }, []);

  // Устанавливаем значение по умолчанию для initialRoute, если оно не установлено
  useEffect(() => {
    if (!initialRoute) {
      logger.warn(
        "initialRoute не установлен. Устанавливаем значение по умолчанию."
      );
      setInitialRoute("Register");
    }
  }, [initialRoute]);

  // Выполняем навигацию после полной инициализации, если есть параметры из глубокой ссылки
  useEffect(() => {
    if (deepLinkParams && navigationRef.isReady()) {
      logger.log("Навигация с использованием глубокой ссылки:", deepLinkParams);
      try {
        navigationRef.navigate(deepLinkParams.name, deepLinkParams.params);
        setDeepLinkParams(null); // Очищаем состояние после навигации
      } catch (error) {
        logger.error(
          "Ошибка при навигации с использованием глубокой ссылки:",
          error
        );
      }
    } else if (deepLinkParams && !navigationRef.isReady()) {
      logger.warn("Навигация не готова, ожидаем...");
    }
  }, [deepLinkParams, isInitializing]);

  if (isInitializing || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <PaperProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <AppNavigator initialRoute={initialRoute} />
      </View>
    </PaperProvider>
  );
};

// Функция создаёт канал "payment-reminders" с вибрацией
async function createVibrationChannel() {
  if (Platform.OS === "android") {
    try {
      // Важно: название совпадает с тем, что указали на бэке — "payment-reminders".
      await Notifications.setNotificationChannelAsync("payment-reminders", {
        name: "Payment Reminders", // любое описание
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500], // паттерн вибрации
        sound: "default", // при желании можно указать "default"
        lightColor: "#FF231F7C", // при желании цвет светодиода
      });
      logger.log("Канал 'payment-reminders' успешно создан/обновлён");
    } catch (err) {
      logger.error("Ошибка при создании канала уведомлений:", err);
    }
  }
}

export default App;
