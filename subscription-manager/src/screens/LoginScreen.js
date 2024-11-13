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
import { loginUser } from "../api/api";
import {
  registerForPushNotificationsAsync,
  sendDeviceTokenToServer,
} from "../utils/notifications";
import { IsValidEmail, IsValidPassword } from "../utils/validation";
import logger from "../utils/logger"; // Импорт логгера

const LoginScreen = ({ navigation }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (name, value) => {
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    if (isLoading) return;

    if (!credentials.email.trim() || !credentials.password.trim()) {
      Alert.alert("Ошибка", "Пожалуйста, заполните все поля.");
      return;
    }

    if (!IsValidEmail(credentials.email)) {
      Alert.alert("Ошибка", "Неверный формат email.");
      return;
    }

    if (!IsValidPassword(credentials.password)) {
      Alert.alert(
        "Ошибка",
        "Пароль должен содержать как минимум 6 символов, включая заглавные и строчные буквы, цифры и специальные символы."
      );
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await loginUser(credentials, navigation.navigate);

      if (response && response.token && response.user_id) {
        logger.log("Пользователь успешно вошел в систему");

        // Регистрируем и отправляем токен устройства на сервер
        const deviceToken = await registerForPushNotificationsAsync();
        if (deviceToken) {
          try {
            await sendDeviceTokenToServer(deviceToken);
            logger.log("Device token обновлен успешно");
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

        navigation.navigate("SubscriptionList");
      } else {
        logger.error("Некорректный ответ от сервера:", response);
        setError("Ошибка при входе в систему. Пожалуйста, попробуйте снова.");
      }
    } catch (error) {
      logger.error("Ошибка при входе в систему:", error);
      setError("Ошибка при входе в систему. Пожалуйста, попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход в систему</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Войти</Text>
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

export default LoginScreen;
