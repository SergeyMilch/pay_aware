import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { requestPasswordReset } from "../api/api";
import logger from "../utils/logger"; // Импорт логгера

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordReset = async () => {
    logger.log("Начало процесса восстановления пароля");

    if (!email.trim()) {
      logger.warn("Пользователь не ввел email");
      Alert.alert("Ошибка", "Пожалуйста, введите email.");
      return;
    }

    setIsLoading(true);
    try {
      logger.log("Отправка запроса на восстановление пароля для email:", email);
      const response = await requestPasswordReset(email);
      if (response.ok) {
        logger.log(
          "Запрос на восстановление пароля успешно отправлен на email:",
          email
        );
        Alert.alert(
          "Успех",
          "Ссылка для восстановления пароля отправлена на ваш email."
        );
        navigation.goBack();
      } else {
        const errorData = await response.json();
        logger.error(
          "Ошибка при отправке запроса на восстановление пароля:",
          errorData.error
        );
        Alert.alert(
          "Ошибка",
          errorData.error || "Не удалось отправить запрос."
        );
      }
    } catch (error) {
      logger.error(
        "Произошла ошибка при отправке запроса на восстановление пароля:",
        error
      );
      Alert.alert("Ошибка", "Произошла ошибка. Попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Забыли пароль?</Text>
      <TextInput
        style={styles.input}
        placeholder="Введите ваш email"
        value={email}
        onChangeText={(value) => {
          logger.log("Пользователь изменяет email");
          setEmail(value.toLowerCase());
        }}
        keyboardType="email-address"
      />
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <TouchableOpacity
          onPress={handlePasswordReset}
          style={styles.resetButton}
          disabled={isLoading}
        >
          <Text style={styles.resetButtonText}>Сбросить пароль</Text>
        </TouchableOpacity>
      )}
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
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  resetButton: {
    backgroundColor: "#7b6dae", // Цвет кнопки
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff", // Цвет текста
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ForgotPasswordScreen;
