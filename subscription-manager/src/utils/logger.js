import { ENVIRONMENT, ENABLE_CRASHLYTICS_LOGGING } from "@env"; // импорт переменных из .env
import crashlytics from "@react-native-firebase/crashlytics"; // импорт Crashlytics

const isDevelopment = ENVIRONMENT === "development";
const isCrashlyticsEnabled = ENABLE_CRASHLYTICS_LOGGING === "true";

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
    } else if (isCrashlyticsEnabled) {
      // Логирование в Crashlytics только важных сообщений
      crashlytics().log(message);
      optionalParams.forEach((param) => {
        crashlytics().log(JSON.stringify(filterSensitiveData(param)));
      });
    }
  },

  // Логирование для предупреждений
  warn: (message, ...optionalParams) => {
    if (isDevelopment) {
      console.warn("Warning:", message, ...optionalParams);
    } else if (isCrashlyticsEnabled) {
      // Логируем предупреждения в Crashlytics, чтобы отслеживать потенциальные проблемы
      crashlytics().log(`Warning: ${message}`);
      optionalParams.forEach((param) => {
        crashlytics().log(
          `Warning: ${JSON.stringify(filterSensitiveData(param))}`
        );
      });
    }
  },

  // Логирование для ошибок
  error: (error) => {
    const filteredError = filterSensitiveData(error);
    if (isDevelopment) {
      console.error(filteredError);
    } else if (isCrashlyticsEnabled) {
      // Логируем ошибку в Crashlytics для последующего анализа
      if (error instanceof Error) {
        crashlytics().recordError(error);
        crashlytics().log(`Error: ${error.message}`);
      } else {
        crashlytics().recordError(new Error(filteredError));
      }
    }
  },
};

export default logger;
