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
import { registerUser } from "../api/api";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import { IsValidEmail, IsValidPassword } from "../utils/validation";
import logger from "../utils/logger";

const RegisterScreen = ({ navigation }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      Alert.alert("Ошибка", "Пожалуйста, заполните все поля.");
      setIsLoading(false);
      return;
    }

    if (!IsValidEmail(credentials.email)) {
      Alert.alert("Ошибка", "Неверный формат email.");
      setIsLoading(false);
      return;
    }

    if (!IsValidPassword(credentials.password)) {
      Alert.alert(
        "Ошибка",
        "Пароль должен содержать как минимум 6 символов, включая заглавные и строчные буквы, цифры и специальные символы."
      );
      setIsLoading(false);
      return;
    }

    try {
      // Регистрируем токен устройства перед регистрацией пользователя
      const deviceToken = await registerForPushNotificationsAsync();
      if (!deviceToken) {
        logger.warn("Не удалось получить токен устройства");
        Alert.alert(
          "Внимание",
          "Не удалось получить токен устройства. Попробуйте снова."
        );
        setIsLoading(false);
        return;
      }

      logger.log("Device Token:", deviceToken);

      // Обновляем данные для регистрации с токеном устройства
      const updatedCredentials = {
        ...credentials,
        device_token: deviceToken,
      };

      // Регистрируем пользователя вместе с токеном устройства
      const response = await registerUser(updatedCredentials);

      if (response && response.token && response.user_id) {
        logger.log("Пользователь успешно зарегистрирован");

        // Сохраняем токен и user_id
        await AsyncStorage.setItem("authToken", response.token);
        await AsyncStorage.setItem("userId", response.user_id.toString());
        setAuthToken(response.token);

        navigation.navigate("SubscriptionList");
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
