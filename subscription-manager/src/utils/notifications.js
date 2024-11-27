import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { updateDeviceTokenOnServer } from "../api/api";
import logger from "../utils/logger"; // Импорт логгера

// Функция для регистрации и получения push-токена
export async function registerForPushNotificationsAsync() {
  let token;
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      logger.warn(
        "Не удалось получить разрешение на push-уведомления. Проверьте настройки."
      );
      return null;
    }

    // Получение токена устройства
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.projectId || undefined,
    });

    if (data) {
      logger.log("Device Token:", data);
      token = data;
    } else {
      logger.error("Ошибка: не удалось получить токен устройства.");
      return null;
    }

    // Сохраняем токен в AsyncStorage, если он изменился
    const savedToken = await AsyncStorage.getItem("deviceToken");
    if (savedToken !== token) {
      await AsyncStorage.setItem("deviceToken", token);
      await sendDeviceTokenToServer(token); // обновляем на сервере только при изменении
    } else {
      logger.log(
        "Device token не изменился, обновление на сервере не требуется"
      );
    }

    return token;
  } catch (error) {
    logger.error("Ошибка при запросе разрешения на уведомления:", error);
    return null;
  }
}

// Функция для отправки токена устройства на сервер
export async function sendDeviceTokenToServer(deviceToken) {
  try {
    const authToken = await AsyncStorage.getItem("authToken");
    const userId = await AsyncStorage.getItem("userId");

    if (!authToken) {
      logger.error(
        "authToken отсутствует, невозможно обновить токен устройства"
      );
      return;
    }

    if (!userId) {
      logger.error("userId отсутствует, невозможно обновить токен устройства");
      return;
    }

    if (typeof updateDeviceTokenOnServer !== "function") {
      logger.error("Ошибка: updateDeviceTokenOnServer is not a function.");
      return;
    }

    // Добавим логирование перед отправкой запроса
    logger.log(`Отправка токена устройства на сервер для user_id: ${userId}`);

    await updateDeviceTokenOnServer({
      device_token: deviceToken,
      user_id: parseInt(userId, 10),
    });

    logger.log("Device token успешно обновлен на сервере");
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.error(
        "Ошибка при обновлении токена устройства: Пользователь не найден"
      );
    } else {
      logger.error("Ошибка при обновлении токена устройства:", error);
    }
    throw error;
  }
}
