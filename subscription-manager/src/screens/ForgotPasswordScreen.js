import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { requestPasswordReset } from "../api/api";

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      Alert.alert("Ошибка", "Пожалуйста, введите email.");
      return;
    }

    try {
      const response = await requestPasswordReset(email);
      if (response.ok) {
        Alert.alert(
          "Успех",
          "Ссылка для восстановления пароля отправлена на ваш email."
        );
        navigation.goBack();
      } else {
        const errorData = await response.json();
        Alert.alert(
          "Ошибка",
          errorData.error || "Не удалось отправить запрос."
        );
      }
    } catch (error) {
      Alert.alert("Ошибка", "Произошла ошибка. Попробуйте позже.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Забыли пароль?</Text>
      <TextInput
        style={styles.input}
        placeholder="Введите ваш email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Button title="Сбросить пароль" onPress={handlePasswordReset} />
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

export default ForgotPasswordScreen;
