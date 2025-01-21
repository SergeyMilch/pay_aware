import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { loginUser, checkTokenAndNavigate } from "../api/api";
import {
  registerForPushNotificationsAsync,
  sendDeviceTokenToServer,
} from "../utils/notifications";
import { IsValidEmail, IsValidPassword } from "../utils/validation";
import logger from "../utils/logger"; // Импорт логгера
import * as SecureStore from "expo-secure-store";

const LoginScreen = ({ navigation }) => {
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

  const handleLogin = async () => {
    if (isLoading) {
      logger.warn("Логин уже выполняется, повторный вызов отменен");
      return;
    }

    logger.log("Начало процесса логина");

    // Валидация полей
    if (!credentials.email.trim() || !credentials.password.trim()) {
      logger.warn("Поля для логина не заполнены");
      Alert.alert("Ошибка", "Пожалуйста, заполните все поля.");
      return;
    }

    if (!IsValidEmail(credentials.email)) {
      logger.warn("Неверный формат email при логине:", credentials.email);
      Alert.alert("Ошибка", "Неверный формат email.");
      return;
    }

    if (!IsValidPassword(credentials.password)) {
      logger.warn("Пароль не соответствует требованиям безопасности");
      Alert.alert(
        "Ошибка",
        "Пароль должен содержать как минимум 6 символов, включая заглавные и строчные буквы, цифры и специальные символы."
      );
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      logger.log("Отправляем запрос на сервер для логина");
      const response = await loginUser(credentials, navigation.navigate);

      if (response && response.token && response.user_id) {
        logger.log("Пользователь успешно вошел в систему");

        // Сохраняем токен и user_id
        try {
          logger.log("Сохраняем токен и user_id в SecureStore");
          await SecureStore.setItemAsync("authToken", response.token);
          await SecureStore.setItemAsync("userId", response.user_id.toString());
          setAuthToken(response.token);
        } catch (error) {
          logger.error("Ошибка при сохранении токена или userId:", error);
        }

        // Регистрируем и отправляем токен устройства на сервер
        logger.log(
          "Начинаем регистрацию токена устройства для push-уведомлений"
        );
        const deviceToken = await registerForPushNotificationsAsync();
        if (deviceToken) {
          logger.log("Токен устройства получен:", deviceToken);
          try {
            await sendDeviceTokenToServer(deviceToken);
            logger.log("Токен устройства успешно отправлен на сервер");
          } catch (err) {
            logger.error(
              "Не удалось обновить токен устройства на сервере:",
              err
            );
          }
        } else {
          logger.warn("Не удалось получить токен устройства");
          Alert.alert(
            "Внимание",
            "Вход выполнен успешно, но не удалось получить токен устройства."
          );
        }

        // Проверка наличия ПИН-кода
        const savedPin = await SecureStore.getItemAsync("pinCode");
        if (!savedPin) {
          logger.warn(
            "ПИН-код отсутствует, перенаправляем на экран установки ПИН-кода"
          );
          Alert.alert(
            "Установка ПИН-кода",
            "Для упрощения доступа к приложению и обеспечения безопасности, пожалуйста, установите ПИН-код. Это позволит вам входить в приложение быстро и удобно."
          );
          navigation.navigate("SetPinScreen");
        } else {
          logger.log(
            "ПИН-код уже установлен, переход на экран списка подписок"
          );
          navigation.navigate("SubscriptionList");
        }
      } else {
        logger.error("Некорректный ответ от сервера при логине:", response);
        setError("Ошибка при входе в систему. Пожалуйста, попробуйте снова.");
      }
    } catch (error) {
      logger.error("Ошибка при входе в систему:", error);
      setError("Ошибка при входе в систему. Пожалуйста, попробуйте снова.");
    } finally {
      setIsLoading(false);
      logger.log("Процесс логина завершен");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход в систему</Text>
      <TextInput
        placeholder="Email"
        value={credentials.email}
        onChangeText={(value) =>
          handleInputChange("email", value.toLowerCase())
        }
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
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Войти</Text>
        </TouchableOpacity>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          onPress={() => {
            logger.log("Переход на экран восстановления пароля");
            navigation.navigate("ForgotPasswordScreen");
          }}
        >
          <Text style={{ color: "#007BFF", textAlign: "center" }}>
            Забыли пароль?
          </Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: "#7b6dae",
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

export default LoginScreen;
