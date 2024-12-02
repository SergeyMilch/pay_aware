import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { updateDeviceTokenOnServer } from "../api/api";
import Constants from "expo-constants";
import logger from "../utils/logger"; // Импорт логгера

// Функция для регистрации и получения push-токена
export async function registerForPushNotificationsAsync() {
  logger.log("Начало регистрации для получения push-уведомлений...");
  let deviceToken;
  try {
    // Получение существующего статуса разрешений
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    logger.log("Текущий статус разрешений: ", existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      logger.log("Запрос разрешений для push-уведомлений...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      logger.log(
        "Запрос разрешений завершен, полученный статус: ",
        finalStatus
      );
    }

    if (finalStatus !== "granted") {
      logger.warn(
        "Не удалось получить разрешение на push-уведомления. Проверьте настройки устройства."
      );
      return null;
    }

    // Получение токена устройства (проблема в доступности правильного значения projectId в runtime
    // закодируем жестко, т.к. используем это в одном месте. Но можно сделать так:
    // config.js - создать файл
    // export const projectId = "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxx";
    // В дальнейшем можно использовать его во всех нужных местах:
    // import { projectId } from './config';
    // const { data } = await Notifications.getExpoPushTokenAsync({ projectId });)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      "6e51137e-084d-4364-a90c-14f366df944e";

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });

    logger.log("Project ID для получения токена устройства:", projectId);

    if (data) {
      logger.log("Device Token:", data);
      deviceToken = data;
    } else {
      logger.error("Ошибка: не удалось получить токен устройства.");
      return null;
    }

    // Сохраняем токен в SecureStore, если он изменился
    logger.log(
      "Попытка получения сохраненного токена устройства из SecureStore..."
    );
    const savedToken = await SecureStore.getItemAsync("deviceToken");
    logger.log("Сохраненный токен устройства из SecureStore: ", savedToken);

    if (savedToken !== deviceToken) {
      logger.log(
        "Токен устройства изменился, сохраняем новый токен в SecureStore..."
      );
      await SecureStore.setItemAsync("deviceToken", deviceToken);
      logger.log(
        "Токен успешно сохранен в SecureStore. Обновляем токен на сервере..."
      );
      await sendDeviceTokenToServer(deviceToken); // обновляем на сервере только при изменении
    } else {
      logger.log(
        "Токен устройства не изменился, обновление на сервере не требуется."
      );
    }

    return deviceToken;
  } catch (error) {
    logger.error("Ошибка внутри registerForPushNotificationsAsync:", error);
    return null;
  }
}

// Функция для отправки токена устройства на сервер
export async function sendDeviceTokenToServer(deviceToken) {
  try {
    // Получаем authToken и userId из SecureStore
    logger.log("Попытка получения authToken и userId из SecureStore...");
    const authToken = await SecureStore.getItemAsync("authToken");
    const userId = await SecureStore.getItemAsync("userId");

    logger.log("Полученный authToken: ", authToken);
    logger.log("Полученный userId: ", userId);

    // Проверка наличия токенов
    if (!authToken) {
      logger.error(
        "authToken отсутствует, невозможно обновить токен устройства."
      );
      return;
    }

    if (!userId) {
      logger.error("userId отсутствует, невозможно обновить токен устройства.");
      return;
    }

    // Добавим логирование перед отправкой запроса
    logger.log(`Отправка токена устройства на сервер для user_id: ${userId}`);
    logger.log("Токен устройства: ", deviceToken);

    // Проверка типа функции updateDeviceTokenOnServer
    if (typeof updateDeviceTokenOnServer !== "function") {
      logger.error("Ошибка: updateDeviceTokenOnServer не является функцией.");
      return;
    }

    // Отправка запроса на сервер
    logger.log("Отправка запроса на обновление токена устройства на сервер...");
    const response = await updateDeviceTokenOnServer({
      device_token: deviceToken,
      user_id: parseInt(userId, 10),
    });

    logger.log("Device token успешно обновлен на сервере: ", response);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.error(
        "Ошибка при обновлении токена устройства: Пользователь не найден."
      );
    } else {
      logger.error("Ошибка при обновлении токена устройства:", error);
    }
    throw error;
  }
}
