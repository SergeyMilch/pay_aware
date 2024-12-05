import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { registerUser, checkTokenAndNavigate } from "../api/api";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import { IsValidEmail, IsValidPassword } from "../utils/validation";
import logger from "../utils/logger"; // Импорт логгера
import { setAuthToken } from "../api/api"; // Подключаем setAuthToken
import * as SecureStore from "expo-secure-store";

const RegisterScreen = ({ navigation }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initializeNavigation = async () => {
      logger.log("Проверяем токен и перенаправляем, если необходимо");
      await checkTokenAndNavigate(setInitialRoute);
    };

    initializeNavigation();
  }, []);

  const handleInputChange = (name, value) => {
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async () => {
    if (isLoading) {
      logger.warn("Регистрация уже выполняется, повторный вызов отменен");
      return;
    }

    setIsLoading(true);
    logger.log("Начало процесса регистрации");

    // Валидация полей
    if (!credentials.email.trim() || !credentials.password.trim()) {
      logger.warn("Не заполнены обязательные поля регистрации");
      Alert.alert("Ошибка", "Пожалуйста, заполните все поля.");
      setIsLoading(false);
      return;
    }

    if (!IsValidEmail(credentials.email)) {
      logger.warn("Неверный формат email при регистрации:", credentials.email);
      Alert.alert("Ошибка", "Неверный формат email.");
      setIsLoading(false);
      return;
    }

    if (!IsValidPassword(credentials.password)) {
      logger.warn("Пароль не соответствует требованиям безопасности");
      Alert.alert(
        "Ошибка",
        "Пароль должен содержать как минимум 6 символов, включая заглавные и строчные буквы, цифры и специальные символы."
      );
      setIsLoading(false);
      return;
    }

    try {
      // Объяснение важности push-уведомлений
      logger.log("Запрашиваем разрешение на получение push-уведомлений");
      const userConsent = await new Promise((resolve) => {
        Alert.alert(
          "Важное уведомление",
          "Для того чтобы получать напоминания о подписках, необходимо разрешить отправку push-уведомлений. Это ключевая функция приложения.",
          [
            { text: "Отказаться", onPress: () => resolve(false) },
            { text: "Разрешить", onPress: () => resolve(true) },
          ]
        );
      });

      let deviceToken = null;
      if (userConsent) {
        logger.log("Пользователь разрешил получение уведомлений");
        deviceToken = await registerForPushNotificationsAsync();
        if (deviceToken) {
          logger.log("Токен устройства успешно получен:", deviceToken);
        } else {
          logger.warn("Не удалось получить токен устройства");
        }
      } else {
        logger.warn("Пользователь отказался от получения уведомлений");
      }

      // Обновляем данные для регистрации с токеном устройства (если имеется)
      const updatedCredentials = {
        ...credentials,
        device_token: deviceToken,
      };

      // Регистрируем пользователя вместе с токеном устройства (если он есть)
      logger.log("Отправляем данные пользователя на сервер для регистрации");
      const response = await registerUser(updatedCredentials);

      if (response && response.token && response.user_id) {
        logger.log("Пользователь успешно зарегистрирован");

        // Сохраняем токен и user_id
        try {
          logger.log("Сохраняем токен и user_id в SecureStore");
          await SecureStore.setItemAsync("authToken", response.token);
          await SecureStore.setItemAsync("userId", response.user_id.toString());
          setAuthToken(response.token);
        } catch (error) {
          logger.error("Ошибка при сохранении токена или userId:", error);
        }

        // Объяснение важности ПИН-кода
        Alert.alert(
          "Установка ПИН-кода",
          "Для упрощения доступа к приложению и обеспечения безопасности, пожалуйста, установите ПИН-код. Это позволит вам входить в приложение быстро и удобно."
        );

        logger.log("Переход на экран установки ПИН-кода");
        navigation.navigate("SetPinScreen");
      } else {
        logger.error(
          "Некорректный ответ от сервера при регистрации:",
          response
        );
        setError("Ошибка при регистрации. Пожалуйста, попробуйте снова.");
      }
    } catch (error) {
      logger.error("Ошибка при регистрации:", error);
      setError("Ошибка при регистрации. Пожалуйста, попробуйте снова.");
    } finally {
      setIsLoading(false);
      logger.log("Регистрация завершена");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Регистрация</Text>
      <TextInput
        placeholder="Email"
        value={credentials.email}
        onChangeText={(value) => handleInputChange("email", value)}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder="Пароль"
        value={credentials.password}
        onChangeText={(value) => handleInputChange("password", value)}
        secureTextEntry
        style={styles.input}
      />
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </Text>
        </TouchableOpacity>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 4,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  errorText: {
    color: "red",
    marginTop: 15,
    textAlign: "center",
  },
});

export default RegisterScreen;
