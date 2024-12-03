import axios from "axios";
import jwtDecode from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService";
import { API_URL } from "@env";

// Настройка экземпляра axios с базовым URL и заголовками
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Функция для добавления/удаления токена авторизации в заголовки
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// Устанавливаем токен из SecureStore при запуске приложения
export const initializeAuthToken = async () => {
  const token = await SecureStore.getItemAsync("authToken");
  if (token) {
    setAuthToken(token);
  }
};

// isTokenExpired проверяет срок действия токена
export const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    if (decoded.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    }
    return true;
  } catch (error) {
    console.error("Ошибка при проверке истечения токена:", error);
    return true; // Если произошла ошибка, считаем, что токен истек
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

        if (status === 401 && data.error === "Token has expired") {
          await SecureStore.deleteItemAsync("authToken");
          await SecureStore.deleteItemAsync("userId");

          Alert.alert(
            "Сессия истекла",
            "Ваша сессия истекла, пожалуйста, войдите снова.",
            [
              {
                text: "OK",
                onPress: () => {
                  if (navigationRef.isReady()) {
                    navigationRef.navigate("Login");
                  }
                },
              },
            ]
          );
          return Promise.reject(new Error("SessionExpired"));
        } else if (status === 409) {
          logger.warn("Ошибка при регистрации пользователя:", error);
        } else {
          logger.error("Ошибка от сервера:", error);
        }
      } else if (error.code === "ECONNABORTED") {
        logger.warn("Ошибка таймаута запроса:", error);
      } else {
        logger.warn("Неизвестная ошибка:", error);
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
      logger.log("Сохраняем токен и user_id...");
      await SecureStore.setItemAsync("authToken", token);
      await SecureStore.setItemAsync("userId", user_id.toString());

      setAuthToken(token);
      logger.log("Токен авторизации установлен.");

      if (navigationRef.isReady()) {
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
    logger.error("Ошибка при регистрации пользователя:", error);
    handleRegistrationError(error);
    throw error;
  }
};

// Обработка ошибок при регистрации
const handleRegistrationError = (error) => {
  if (error.response?.status === 409) {
    Alert.alert(
      "Пользователь уже зарегистрирован",
      "Этот email уже занят. Пожалуйста, войдите с вашими данными.",
      [
        { text: "Отмена", style: "cancel" }, // Кнопка "Отмена" будет слева
        {
          text: "Войти", // Кнопка "Войти" будет справа
          onPress: () => {
            setTimeout(() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate("Login");
              }
            }, 0);
          },
        },
      ]
    );
  } else if (error.response?.status === 401) {
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login");
      }
    }, 0);
  } else {
    Alert.alert(
      "Ошибка",
      "Ошибка при регистрации. Пожалуйста, попробуйте снова."
    );
  }
};

// Функция для логина пользователя
export const loginUser = async (credentials) => {
  try {
    const response = await api.post("/users/login", credentials);
    const { token, user_id } = response.data || {};

    if (token && user_id) {
      await SecureStore.setItemAsync("authToken", token);
      await SecureStore.setItemAsync("userId", user_id.toString());
      setAuthToken(token);
      if (navigationRef.isReady()) {
        navigationRef.navigate("SubscriptionList");
      }
      return response.data;
    } else {
      Alert.alert("Ошибка", "Ошибка при входе. Пожалуйста, попробуйте снова.");
    }
  } catch (error) {
    handleLoginError(error);
    throw error;
  }
};

// Обработка ошибок при логине
const handleLoginError = (error) => {
  if (error.response?.status === 401) {
    Alert.alert("Ошибка входа", "Неправильный email или пароль.");
  } else if (error.response?.status === 404) {
    Alert.alert("Пользователь не найден", "Хотите создать новый аккаунт?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Зарегистрироваться",
        onPress: () => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("Register");
          }
        },
      },
    ]);
  } else {
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
  const response = await fetch(`${API_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return response;
};
