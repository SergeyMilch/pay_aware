import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { resetPassword } from "../api/api";
import * as SecureStore from "expo-secure-store";

const ResetPasswordScreen = ({ navigation, route }) => {
  const [newPassword, setNewPassword] = useState("");
  const [token] = useState(route.params?.token || "");

  useEffect(() => {
    if (!token) {
      Alert.alert("Ошибка", "Токен не найден. Попробуйте снова.", [
        {
          text: "OK",
          onPress: () => navigation.navigate("ForgotPasswordScreen"),
        },
      ]);
    }
  }, [token]);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert("Ошибка", "Пожалуйста, введите новый пароль.");
      return;
    }

    try {
      const response = await resetPassword(token, newPassword);
      if (response.ok) {
        await SecureStore.deleteItemAsync("authToken");
        await SecureStore.deleteItemAsync("userId");

        Alert.alert(
          "Успех",
          "Пароль успешно изменен. Пожалуйста, войдите снова.",
          [{ text: "OK", onPress: () => navigation.navigate("Login") }]
        );
      } else {
        const errorData = await response.json();
        Alert.alert("Ошибка", errorData.error || "Не удалось сбросить пароль.");
      }
    } catch (error) {
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
        onChangeText={setNewPassword}
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
