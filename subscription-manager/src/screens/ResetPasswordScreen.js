import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { resetPassword } from "../api/api";
import * as SecureStore from "expo-secure-store";
import logger from "../utils/logger"; // Импорт логгера

const ResetPasswordScreen = ({ navigation, route }) => {
  const [newPassword, setNewPassword] = useState("");
  const token = route.params?.token || "";

  useEffect(() => {
    if (!token) {
      logger.error("Ошибка: Токен для сброса пароля отсутствует");
      Alert.alert("Ошибка", "Токен не найден. Попробуйте снова.", [
        {
          text: "OK",
          onPress: () => {
            logger.log("Переход на экран восстановления пароля");
            navigation.navigate("ForgotPasswordScreen");
          },
        },
      ]);
    } else {
      logger.log("Токен для сброса пароля успешно получен:", token);
    }
  }, [token]);

  const handleResetPassword = async () => {
    logger.log("Начало процесса сброса пароля");

    if (!newPassword.trim()) {
      logger.warn("Ошибка: Новый пароль не введен");
      Alert.alert("Ошибка", "Пожалуйста, введите новый пароль.");
      return;
    }

    try {
      logger.log("Отправка запроса на сервер для сброса пароля");
      const result = await resetPassword(token, newPassword);

      if (result.success) {
        logger.log("Пароль успешно сброшен, удаление временных данных");
        await SecureStore.deleteItemAsync("authToken"); // Удаляем токен
        await SecureStore.deleteItemAsync("pinCode"); // Удаляем старый ПИН-код
        await SecureStore.deleteItemAsync("userId"); // Удаляем userId

        Alert.alert(
          "Успех",
          "Пароль успешно изменен. Пожалуйста, войдите снова.",
          [
            {
              text: "OK",
              onPress: () => {
                logger.log("Переход на экран логина после сброса пароля");
                navigation.navigate("Login");
              },
            },
          ]
        );
      } else {
        logger.error("Ошибка сброса пароля с сервера:", result.error);
        Alert.alert("Ошибка", result.error || "Не удалось сбросить пароль.");
      }
    } catch (error) {
      logger.error("Ошибка при сбросе пароля:", error);
      Alert.alert("Ошибка", "Произошла ошибка. Попробуйте позже.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Сброс пароля</Text>
      <TextInput
        style={styles.input}
        placeholder="Введите новый пароль"
        value={newPassword}
        onChangeText={(value) => {
          logger.log("Пользователь изменяет новый пароль");
          setNewPassword(value);
        }}
        secureTextEntry
      />
      <Button title="Сбросить пароль" onPress={handleResetPassword} />
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
});

export default ResetPasswordScreen;
