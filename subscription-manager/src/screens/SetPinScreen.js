import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import logger from "../utils/logger";
import { setPin as setPinApi, checkTokenAndNavigate } from "../api/api"; // Импорт функции setPinApi

const SetPinScreen = ({ navigation }) => {
  const [pinValue, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    const checkToken = async () => {
      logger.log("Проверка токена перед установкой ПИН-кода");
      await checkTokenAndNavigate(setInitialRoute);
    };
    checkToken();
  }, []);

  const handleSetPin = async () => {
    logger.log("Начало процесса установки ПИН-кода");

    if (pinValue.length !== 4) {
      logger.warn("ПИН-код не соответствует требуемой длине (4 цифры)");
      Alert.alert("Ошибка", "ПИН-код должен состоять из 4 цифр.");
      return;
    }

    if (pinValue !== confirmPin) {
      logger.warn("Введенные ПИН-коды не совпадают");
      Alert.alert("Ошибка", "ПИН-коды не совпадают.");
      return;
    }

    try {
      const userId = await SecureStore.getItemAsync("userId");
      if (!userId) {
        logger.error("Ошибка: Не удалось получить userId");
        Alert.alert("Ошибка", "Произошла ошибка. Попробуйте снова.");
        return;
      }

      logger.log("Отправляем запрос на сервер для сохранения ПИН-кода");
      await setPinApi(userId, pinValue); // Вызов эндпоинта для сохранения PIN-кода на сервере

      logger.log("Сохранение ПИН-кода в SecureStore");
      await SecureStore.setItemAsync("pinCode", pinValue);
      logger.log("ПИН-код успешно сохранен в SecureStore");
      Alert.alert("Успех", "ПИН-код успешно установлен.");
      navigation.navigate("SubscriptionList");
    } catch (error) {
      logger.error("Ошибка при установке ПИН-кода:", error);
      Alert.alert("Ошибка", "Не удалось сохранить ПИН-код.");
    }
  };

  return (
    <View style={styles.container}>
      <Text>Введите новый ПИН-код (4 цифры):</Text>
      <TextInput
        value={pinValue}
        onChangeText={(value) => {
          logger.log("Изменение ПИН-кода пользователем");
          setPinValue(value);
        }}
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        style={styles.input}
      />
      <Text>Подтвердите ПИН-код:</Text>
      <TextInput
        value={confirmPin}
        onChangeText={(value) => {
          logger.log("Изменение подтверждения ПИН-кода пользователем");
          setConfirmPin(value);
        }}
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        style={styles.input}
      />
      <TouchableOpacity onPress={handleSetPin} style={styles.setPinButton}>
        <Text style={styles.setPinButtonText}>Установить ПИН-код</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  input: {
    borderWidth: 1,
    padding: 8,
    marginVertical: 16,
    width: "80%",
    textAlign: "center",
  },
  setPinButton: {
    backgroundColor: "#7b6dae", // Цвет кнопки
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  setPinButtonText: {
    color: "#fff", // Цвет текста
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SetPinScreen;
