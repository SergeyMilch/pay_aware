import { ENVIRONMENT } from "@env"; // импорт переменных из .env

const isDevelopment = ENVIRONMENT === "development";

const filterSensitiveData = (data) => {
  // Фильтрация конфиденциальных данных, если это объект
  if (typeof data === "object" && data !== null) {
    const { authToken, password, ...safeData } = data; // исключаем конфиденциальные поля
    return safeData;
  }
  return data;
};

const logger = {
  // Логирование для обычных сообщений
  log: (message, ...optionalParams) => {
    if (isDevelopment) {
      console.log(message, ...optionalParams);
    } else {
      // Обработка логов для продакшн-версии
      // const filteredParams = optionalParams.map(filterSensitiveData);
      // sendLogToServer('log', message, ...filteredParams); // отправка на удаленный сервер

      // Если отправка логов на сервер не используется, выводим их в консоль
      console.log(message, ...optionalParams.map(filterSensitiveData));
    }
  },

  // Логирование для предупреждений
  warn: (message, ...optionalParams) => {
    if (isDevelopment) {
      console.warn("Warning:", message, ...optionalParams);
    } else {
      // Обработка предупреждений для продакшн-версии
      // const filteredParams = optionalParams.map(filterSensitiveData);
      // sendLogToServer('warn', message, ...filteredParams); // отправка предупреждений на удаленный сервер

      // Если отправка предупреждений на сервер не используется, выводим их в консоль
      console.warn(
        "Warning:",
        message,
        ...optionalParams.map(filterSensitiveData)
      );
    }
  },

  // Логирование для ошибок
  error: (error) => {
    if (isDevelopment) {
      console.error(error);
    } else {
      // Фильтрация ошибки перед логированием
      // const safeError = filterSensitiveData(error);
      // sendLogToServer('error', safeError); // отправка ошибки на сервер

      // Для продакшена выводим отфильтрованную ошибку в консоль
      console.error(filterSensitiveData(error));
    }
  },
};

export default logger;
