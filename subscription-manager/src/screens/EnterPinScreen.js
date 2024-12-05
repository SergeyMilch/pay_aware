import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import logger from "../utils/logger";
import { checkTokenAndNavigate, loginWithPin } from "../api/api"; // Импорт функции loginWithPin

const EnterPinScreen = ({ navigation }) => {
  const [pinValue, setPinValue] = useState("");

  useEffect(() => {
    const checkPinAvailability = async () => {
      logger.log("Начало проверки наличия ПИН-кода");

      // Проверка истечения токена
      await checkTokenAndNavigate(setInitialRoute);

      try {
        const savedPin = await SecureStore.getItemAsync("pinCode");
        if (!savedPin) {
          logger.warn("ПИН-код отсутствует, перенаправляем на экран логина");
          navigation.navigate("Login");
        } else {
          logger.log("ПИН-код найден, пользователь может ввести его для входа");
        }
      } catch (error) {
        logger.error("Ошибка при проверке наличия ПИН-кода:", error);
      }
    };

    checkPinAvailability();
  }, []);

  const handleEnterPin = async () => {
    logger.log("Начало проверки введенного ПИН-кода");

    try {
      const userId = await SecureStore.getItemAsync("userId");
      if (!userId) {
        logger.error("Ошибка: Не удалось получить userId");
        Alert.alert("Ошибка", "Произошла ошибка. Попробуйте снова.");
        return;
      }

      logger.log("Отправляем запрос на сервер для входа через ПИН-код");
      const response = await loginWithPin(userId, pinValue);

      if (response) {
        logger.log("ПИН-код введен верно, переход на экран подписок");
        Alert.alert("Успех", "ПИН-код введен верно.");
        navigation.navigate("SubscriptionList");
      }
    } catch (error) {
      logger.error("Ошибка при проверке введенного ПИН-кода:", error);
      Alert.alert("Ошибка", "Неверный ПИН-код. Попробуйте снова.");
    }
  };

  const handleForgotPin = async () => {
    logger.log(
      "Пользователь нажал на кнопку 'Забыли ПИН-код?', сбрасываем ПИН-код"
    );

    try {
      // Удаляем ПИН-код из SecureStore
      await SecureStore.deleteItemAsync("pinCode");
      logger.log("ПИН-код успешно удалён");

      // Вызов эндпоинта для сброса ПИН-кода на сервере
      const userId = await SecureStore.getItemAsync("userId");
      if (!userId) {
        logger.error("Ошибка: Не удалось получить userId");
        Alert.alert("Ошибка", "Произошла ошибка. Попробуйте снова.");
        return;
      }

      logger.log(
        "Перенаправляем пользователя на экран Login (для установки нового ПИН-кода)"
      );
      navigation.navigate("Login");
    } catch (error) {
      logger.error("Ошибка при удалении ПИН-кода:", error);
      Alert.alert("Ошибка", "Не удалось сбросить ПИН-код. Попробуйте снова.");
    }
  };

  return (
    <View style={styles.container}>
      <Text>Введите ПИН-код (4 цифры):</Text>
      <TextInput
        value={pinValue}
        onChangeText={(value) => {
          logger.log("Пользователь изменяет ПИН-код");
          setPinValue(value);
        }}
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        style={styles.input}
      />
      <Button title="Войти" onPress={handleEnterPin} />

      {/* Кнопка для восстановления ПИН-кода */}
      <TouchableOpacity
        onPress={handleForgotPin}
        style={styles.forgotPinButton}
      >
        <Text style={styles.forgotPinText}>Забыли ПИН-код?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  input: {
    borderWidth: 1,
    padding: 8,
    marginVertical: 16,
  },
  forgotPinButton: {
    marginTop: 16,
    alignItems: "center",
  },
  forgotPinText: {
    color: "#007BFF",
  },
});

export default EnterPinScreen;
