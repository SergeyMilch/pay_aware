import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService";
import { API_URL } from "@env";

// Настройка экземпляра axios с базовым URL и заголовками
const api = axios.create({
  baseURL: API_URL,
  // baseURL: "https://4a1e-62-4-40-184.ngrok-free.app",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Устанавливаем токен из SecureStore при запуске приложения
export const initializeAuthToken = async () => {
  try {
    logger.log("Начинаем инициализацию токена авторизации из SecureStore");
    const token = await SecureStore.getItemAsync("authToken");
    if (token) {
      logger.log("Токен успешно восстановлен из SecureStore:", token);
      setAuthToken(token); // Устанавливаем токен в заголовки запросов
    } else {
      logger.warn("Токен не найден в SecureStore");
    }
  } catch (error) {
    logger.error("Ошибка при инициализации токена авторизации:", error);
    setAuthToken(null);
  }
};

// Функция для добавления/удаления токена авторизации в заголовки
export const setAuthToken = (token) => {
  if (token) {
    logger.log("Устанавливаем токен авторизации в заголовки:", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    logger.warn("Удаляем токен авторизации из заголовков");
    delete api.defaults.headers.common["Authorization"];
  }
};

// Функция для проверки токена и навигации
export const checkTokenAndNavigate = async (setInitialRoute) => {
  try {
    logger.log("Начало проверки токена и навигации");

    const token = await SecureStore.getItemAsync("authToken");
    const userId = await SecureStore.getItemAsync("userId");
    const pinCode = await SecureStore.getItemAsync("pinCode");

    if (token) {
      logger.log("Токен успешно восстановлен из SecureStore:", token);
    } else {
      logger.warn("Токен не найден в SecureStore");
    }

    if (userId) {
      logger.log("UserId успешно восстановлен из SecureStore:", userId);
    } else {
      logger.warn("UserId не найден в SecureStore");
    }

    if (pinCode) {
      logger.log("ПИН-код найден в SecureStore");
    } else {
      logger.warn("ПИН-код отсутствует в SecureStore");
    }

    if (token && userId) {
      // Пытаемся получить пользователя с токеном в заголовке
      const user = await getUserById(userId);
      if (user) {
        logger.log("Пользователь найден, перенаправляем на экран подписок");
        setInitialRoute("SubscriptionList");
      } else if (pinCode) {
        logger.warn(
          "Пользователь не найден, но ПИН-код существует, перенаправляем на экран ввода ПИН-кода"
        );
        setInitialRoute("EnterPinScreen");
      } else {
        logger.warn("Пользователь не найден, перенаправляем на регистрацию");
        setInitialRoute("Register");
      }
    } else if (userId && pinCode) {
      logger.warn(
        "Токен отсутствует, но userId и ПИН-код существуют, перенаправляем на экран ввода ПИН-кода"
      );
      setInitialRoute("EnterPinScreen");
    } else {
      logger.warn(
        "Токен, userId и ПИН-код отсутствуют, перенаправляем на регистрацию"
      );
      setInitialRoute("Register");
    }
  } catch (error) {
    logger.error("Ошибка при проверке токена и навигации:", error);
    setInitialRoute("Register");
  }
};

// Устанавливаем интерсептор для обработки ошибок сессии
export const initializeApi = () => {
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { response } = error;
      if (response) {
        const { status, data } = response;

        logger.warn("Ошибка при выполнении запроса:", {
          status,
          data,
        });

        if (status === 401 && data.error === "Token has expired") {
          try {
            await SecureStore.deleteItemAsync("authToken");
            logger.log("Токен авторизации удален из SecureStore (истек)");
          } catch (error) {
            logger.error("Ошибка при удалении токена из SecureStore:", error);
          }

          // Переход на экран ввода ПИН-кода
          Alert.alert(
            "Сессия истекла",
            "Ваша сессия истекла, пожалуйста, введите ПИН-код.",
            [
              {
                text: "OK",
                onPress: () => {
                  if (navigationRef.isReady()) {
                    logger.log(
                      "Переход на экран ввода ПИН-кода после истечения токена"
                    );
                    navigationRef.navigate("EnterPinScreen");
                  }
                },
              },
            ]
          );
          return Promise.reject(new Error("SessionExpired"));
        } else {
          logger.error("Ошибка от сервера:", error);
        }
      } else if (error.code === "ECONNABORTED") {
        logger.warn("Ошибка таймаута запроса:", error);
      } else if (!error.response && error.message.includes("Network Error")) {
        logger.error("Ошибка сети:", error);
        Alert.alert(
          "Ошибка сети",
          "Не удалось подключиться к серверу. Проверьте подключение к интернету и попробуйте снова."
        );
      } else {
        logger.warn("Неизвестная ошибка при выполнении запроса:", error);
      }
      return Promise.reject(error);
    }
  );
};

// Функция для регистрации пользователя
export const registerUser = async (credentials) => {
  try {
    logger.log("Отправляем запрос на регистрацию...");
    const response = await api.post("/users", credentials);
    logger.log("Ответ от сервера при регистрации:", response);

    const { token, user_id } = response.data || {};

    if (token && user_id) {
      try {
        logger.log("Сохраняем токен и user_id в SecureStore...");
        await SecureStore.setItemAsync("authToken", token);
        await SecureStore.setItemAsync("userId", user_id.toString());
        setAuthToken(token);
        logger.log("Токен авторизации установлен.");
      } catch (error) {
        logger.error("Ошибка при сохранении токена или userId:", error);
      }

      if (navigationRef.isReady()) {
        logger.log("Переход на экран подписок после успешной регистрации");
        navigationRef.navigate("SubscriptionList");
      }
    } else {
      logger.error("Некорректный ответ от сервера при регистрации:", response);
      Alert.alert(
        "Ошибка",
        "Некорректный ответ от сервера. Пожалуйста, попробуйте снова."
      );
    }
    return response.data;
  } catch (error) {
    logger.error("Ошибка при отправке запроса на регистрацию:", error);
    handleRegistrationError(error);
    throw error;
  }
};

// Функция для логина пользователя
export const loginUser = async (credentials) => {
  try {
    logger.log("Отправляем запрос на логин...");
    const response = await api.post("/users/login", credentials);
    logger.log("Ответ от сервера при логине:", response);

    const { token, user_id } = response.data || {};

    if (token && user_id) {
      try {
        logger.log("Сохраняем токен и user_id в SecureStore...");
        await SecureStore.setItemAsync("authToken", token);
        await SecureStore.setItemAsync("userId", user_id.toString());
        setAuthToken(token);
        logger.log("Токен авторизации установлен.");
      } catch (error) {
        logger.error("Ошибка при сохранении токена или userId:", error);
      }

      if (navigationRef.isReady()) {
        logger.log("Переход на экран подписок после успешного логина");
        navigationRef.navigate("SubscriptionList");
      }
    } else {
      logger.error("Некорректный ответ от сервера при логине:", response);
      Alert.alert(
        "Ошибка",
        "Некорректный ответ от сервера. Пожалуйста, попробуйте снова."
      );
    }
    return response.data;
  } catch (error) {
    logger.error("Ошибка при отправке запроса на логин:", error);
    handleLoginError(error);
    throw error;
  }
};

export const setPin = async (userId, pin) => {
  try {
    logger.log("Отправляем запрос на установку ПИН-кода...");
    const response = await api.post("/set-pin", {
      user_id: Number(userId),
      pin_code: pin, // Исправлено имя поля
    });
    return response.data;
  } catch (error) {
    logger.error("Ошибка при установке ПИН-кода:", error);
    throw error;
  }
};

// Функция для логина пользователя с пин
export const loginWithPin = async (userId, pin) => {
  try {
    logger.log("Отправляем запрос на логин через ПИН-код...");
    const response = await api.post("/users/login-with-pin", {
      user_id: Number(userId),
      pin_code: pin, // Исправлено имя поля
    });

    const { token } = response.data || {};

    if (token) {
      try {
        logger.log("Сохраняем новый токен в SecureStore...");
        await SecureStore.setItemAsync("authToken", token);
        setAuthToken(token);
        logger.log("Токен авторизации обновлён.");
      } catch (error) {
        logger.error("Ошибка при сохранении токена:", error);
      }

      if (navigationRef.isReady()) {
        logger.log("Переход на экран подписок после успешного входа");
        navigationRef.navigate("SubscriptionList");
      }
    } else {
      logger.error(
        "Некорректный ответ от сервера при входе через ПИН-код:",
        response
      );
      throw new Error("Не удалось войти. Проверьте данные.");
    }
    return response.data;
  } catch (error) {
    logger.error("Ошибка при логине через ПИН-код:", error);
    throw error;
  }
};

// Обработка ошибок при регистрации
const handleRegistrationError = (error) => {
  logger.error("Обработка ошибки при регистрации пользователя:", error);
  if (error.response?.status === 409) {
    Alert.alert(
      "Пользователь уже зарегистрирован",
      "Этот email уже занят. Пожалуйста, войдите с вашими данными.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Войти",
          onPress: () => {
            setTimeout(() => {
              if (navigationRef.isReady()) {
                logger.log(
                  "Переход на экран логина после обнаружения существующего пользователя"
                );
                navigationRef.navigate("Login");
              }
            }, 0);
          },
        },
      ]
    );
  } else if (error.response?.status === 401) {
    logger.warn("Ошибка при регистрации: Неавторизованное действие (401)");
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login");
      }
    }, 0);
  } else {
    logger.warn("Ошибка при регистрации пользователя:", error);
    Alert.alert(
      "Ошибка",
      "Ошибка при регистрации. Пожалуйста, попробуйте снова."
    );
  }
};

// Обработка ошибок при логине
const handleLoginError = (error) => {
  logger.error("Обработка ошибки при логине пользователя:", error);
  if (error.response?.status === 401) {
    Alert.alert("Ошибка входа", "Неправильный email или пароль.");
  } else if (error.response?.status === 404) {
    logger.warn("Ошибка при логине: пользователь не найден (404)");
    Alert.alert("Пользователь не найден", "Хотите создать новый аккаунт?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Зарегистрироваться",
        onPress: () => {
          if (navigationRef.isReady()) {
            logger.log(
              "Переход на экран регистрации после отсутствия пользователя"
            );
            navigationRef.navigate("Register");
          }
        },
      },
    ]);
  } else {
    logger.error("Неизвестная ошибка при логине:", error);
    Alert.alert("Ошибка", "Ошибка при входе. Пожалуйста, попробуйте снова.");
  }
};

// API функции для работы с подписками и пользователями
export const getSubscriptions = createApiCall(
  "/subscriptions",
  "Ошибка при получении подписок"
);
export const getSubscriptionById = createApiCall(
  (id) => `/subscriptions/${id}`,
  "Ошибка при получении подписки"
);
export const createSubscription = createApiCall(
  "/subscriptions",
  "Ошибка при создании подписки",
  "post"
);
export const updateSubscription = async (id, updatedData) => {
  try {
    const response = await api.put(`/subscriptions/${id}`, updatedData);
    return response.data;
  } catch (error) {
    logger.error(
      "Ошибка от сервера при обновлении подписки:",
      error.response?.data || error.message
    );
    throw error;
  }
};
export const deleteSubscription = createApiCall(
  (id) => `/subscriptions/${id}`,
  "Ошибка при удалении подписки",
  "delete"
);
export const updateDeviceTokenOnServer = async ({ device_token, user_id }) => {
  try {
    const response = await api.put("/users/device-token", {
      device_token,
      user_id,
    });
    return response.data;
  } catch (error) {
    logger.error("Ошибка при обновлении токена устройства:", error);
    throw error;
  }
};
export const getUsers = createApiCall(
  "/users",
  "Ошибка при получении списка пользователей"
);
export const getUserById = createApiCall(
  (id) => `/users/${id}`,
  "Ошибка при получении пользователя"
);

// Универсальная функция для вызова API с автоматической обработкой ошибок
function createApiCall(endpoint, errorMessage, method = "get") {
  return async (data) => {
    try {
      const url = typeof endpoint === "function" ? endpoint(data) : endpoint;
      const response = await api[method](
        url,
        method === "get" || method === "delete" ? undefined : data
      );
      return response.data;
    } catch (error) {
      if (error.message === "SessionExpired") {
        return;
      }
      logger.error(`${errorMessage}:`, error);
      throw error;
    }
  };
}

// Запрос на восстановление пароля
export const requestPasswordReset = async (email) => {
  const response = await fetch(`${API_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response;
};

// Запрос на сброс пароля
export const resetPassword = async (token, newPassword) => {
  try {
    const response = await fetch(`${API_URL}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    if (response.ok) {
      logger.log("Пароль успешно сброшен.");
      const data = await response.json(); // Сервер должен возвращать JSON, мы проверяем success: true
      return { success: true, data };
    } else {
      const errorData = await response.json();
      logger.error("Ошибка при сбросе пароля:", errorData.error);
      return {
        success: false,
        error: errorData.error || "Не удалось сбросить пароль.",
      };
    }
  } catch (error) {
    logger.error("Ошибка при сбросе пароля:", error);
    return { success: false, error: "Произошла ошибка. Попробуйте позже." };
  }
};

// Функция для получения истории уведомлений пользователя
export const getUserNotifications = async ({ limit = 20, offset = 0 }) => {
  logger.log("Отправка запроса на /api/notifications", { limit, offset });
  try {
    const response = await api.get("/api/notifications", {
      params: { limit, offset },
    });
    logger.log("Ответ от /api/notifications:", response.data);
    return response.data;
  } catch (error) {
    logger.error("Ошибка при запросе /api/notifications:", error);
    throw error;
  }
};

// Функция для отметки уведомления как прочитанного
export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await api.post(
      `/api/notifications/${notificationId}/read`
    );
    return response.data;
  } catch (error) {
    logger.error("Ошибка при отметке уведомления как прочитанного:", error);
    throw error;
  }
};
