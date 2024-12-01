import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService";
import { API_URL } from "@env";

// Логируем API_URL для проверки
console.log("API_URL:", API_URL);

// Настройка экземпляра axios с базовым URL и заголовками
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Логируем базовый URL для проверки
console.log("Axios Base URL:", api.defaults.baseURL);

// Функция для добавления/удаления токена авторизации в заголовки
export const setAuthToken = (token) => {
  console.log("Setting auth token:", token);
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    console.log("Removing auth token");
    delete api.defaults.headers.common["Authorization"];
  }
};

// Устанавливаем токен из SecureStore при запуске приложения
export const initializeAuthToken = async () => {
  const token = await SecureStore.getItemAsync("authToken");
  console.log("Retrieved token from SecureStore:", token);
  if (token) {
    setAuthToken(token);
  }
};

// Устанавливаем интерсептор для обработки ошибок сессии
export const initializeApi = () => {
  api.interceptors.request.use((request) => {
    console.log("Starting Request:", request);
    return request;
  });

  api.interceptors.response.use(
    (response) => {
      console.log("Response:", response);
      return response;
    },
    async (error) => {
      console.log("Error Response:", error.response || error.message);
      const { response } = error;
      if (response) {
        const { status, data } = response;

        if (status === 401 && data.error === "Token has expired") {
          console.log(
            "Token expired. Clearing SecureStore and navigating to Login."
          );
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
  console.log("Registering user with credentials:", credentials);
  try {
    const response = await api.post("/users", credentials);
    console.log("Register User Response:", response.data);
    const { token, user_id } = response.data || {};

    if (token && user_id) {
      console.log("Saving token and user_id to SecureStore");
      await SecureStore.setItemAsync("authToken", token);
      await SecureStore.setItemAsync("userId", user_id.toString());
      setAuthToken(token);
      logger.log("Пользователь успешно зарегистрирован");
      if (navigationRef.isReady()) {
        navigationRef.navigate("SubscriptionList");
      }
    } else {
      logger.error("Некорректный ответ от сервера при регистрации:", response);
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
  console.log("Handling registration error:", error);
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

// Логируем логин
export const loginUser = async (credentials) => {
  console.log("Logging in user with credentials:", credentials);
  try {
    const response = await api.post("/users/login", credentials);
    console.log("Login Response:", response.data);
    const { token, user_id } = response.data || {};

    if (token && user_id) {
      console.log("Saving token and user_id to SecureStore");
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
    console.log("Login Error:", error);
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
    const url = typeof endpoint === "function" ? endpoint(data) : endpoint;
    console.log(`Calling API: ${url} with method: ${method} and data:`, data);
    try {
      const response = await api[method](
        url,
        method === "get" || method === "delete" ? undefined : data
      );
      console.log("API Response:", response.data);
      return response.data;
    } catch (error) {
      console.log(`${errorMessage}:`, error);
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
