import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { createSubscription } from "../api/api";
import { isValidName, isValidPrice } from "../utils/validation";
import logger from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { navigationRef } from "../navigation/navigationService";
import {
  registerForPushNotificationsAsync,
  sendDeviceTokenToServer,
} from "../utils/notifications";

const CreateSubscriptionScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationOffset, setNotificationOffset] = useState(null);
  const [deviceToken, setDeviceToken] = useState("");

  // Проверка токена при загрузке экрана
  useEffect(() => {
    const checkToken = async () => {
      logger.log("Начало проверки наличия токена авторизации...");
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.log("Токен авторизации успешно найден");
      }
    };
    checkToken();
  }, []);

  const handlePriceChange = (text) => {
    logger.log("Пользователь изменяет стоимость подписки");
    const formattedText = text.replace(",", ".");
    if (isValidPrice(formattedText)) {
      setPrice(formattedText);
      logger.log("Стоимость подписки успешно обновлена:", formattedText);
    } else {
      logger.warn("Некорректная стоимость подписки:", formattedText);
    }
  };

  // Проверка разрешений на уведомления при выборе напоминания
  const handleNotificationOption = async (offset) => {
    logger.log("Проверяем статус разрешений для push-уведомлений...");
    const deviceToken = await registerForPushNotificationsAsync();

    if (deviceToken) {
      logger.log("Получен токен устройства:", deviceToken);
      setDeviceToken(deviceToken);
      try {
        await sendDeviceTokenToServer(deviceToken);
        logger.log("Токен устройства успешно отправлен на сервер.");
      } catch (error) {
        logger.error("Ошибка при отправке токена устройства на сервер:", error);
      }
      setNotificationOffset(offset);
      logger.log("Напоминание установлено за:", offset, "минут");
    } else {
      logger.warn(
        "Не удалось получить разрешение на push-уведомления. Пожалуйста, включите уведомления в настройках."
      );
      Alert.alert(
        "Необходимо включить уведомления",
        "Для получения напоминаний о подписке необходимо включить уведомления. Пожалуйста, включите уведомления в настройках устройства.",
        [
          {
            text: "Ок",
          },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    logger.log("Начало создания подписки...");
    setLoading(true);
    setError("");

    // Проверка входных данных перед отправкой
    if (!isValidName(name)) {
      logger.warn("Некорректное название подписки:", name);
      setError("Название подписки содержит недопустимые символы.");
      setLoading(false);
      return;
    }

    const parsedPrice = parseFloat(parseFloat(price).toFixed(2));
    if (isNaN(parsedPrice)) {
      logger.warn("Некорректная стоимость подписки:", price);
      setError("Введите корректную стоимость подписки.");
      setLoading(false);
      return;
    }

    if (notificationOffset !== null && !deviceToken) {
      logger.warn(
        "Пользователь пытается создать подписку с напоминанием без включенных уведомлений"
      );
      setError(
        "Для установки напоминания необходимо включить уведомления. Пожалуйста, проверьте настройки устройства."
      );
      setLoading(false);
      return;
    }

    try {
      // Проверка токена перед отправкой
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
        return;
      }

      // Создаем подписку
      const response = await createSubscription({
        service_name: name,
        cost: parsedPrice,
        next_payment_date: nextPaymentDate.toISOString(),
        notification_offset: notificationOffset,
      });

      if (response && response.ID) {
        logger.log("Подписка успешно создана:", response);
        setTimeout(() => {
          navigation.goBack();
        }, 500);
      } else {
        logger.warn("Ответ от сервера не содержит ID подписки:", response);
        setError("Не удалось создать подписку. Попробуйте еще раз.");
      }
    } catch (error) {
      if (error.message === "SessionExpired") {
        logger.warn("Сессия истекла, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.error("Ошибка при создании подписки:", error);
        setError("Не удалось создать подписку. Попробуйте еще раз.");
      }
    } finally {
      setLoading(false);
      logger.log("Процесс создания подписки завершен");
    }
  };

  const showDatePicker = () => {
    logger.log("Показать выбор даты");
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    logger.log("Скрыть выбор даты");
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    logger.log("Дата следующего платежа выбрана:", date);
    setNextPaymentDate(date); // Сохраняем объект Date напрямую
    hideDatePicker();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Название сервиса</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(value) => {
          logger.log("Пользователь изменяет название подписки");
          setName(value);
        }}
        placeholder="Введите название подписки"
      />
      <Text style={styles.label}>Стоимость</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={handlePriceChange}
        placeholder="Введите стоимость подписки"
        keyboardType="numeric"
      />
      <Text style={styles.label}>Дата следующего платежа</Text>
      <TouchableOpacity onPress={showDatePicker}>
        <TextInput
          style={styles.input}
          value={nextPaymentDate ? nextPaymentDate.toLocaleDateString() : ""}
          placeholder="Выберите дату следующего платежа"
          editable={false}
        />
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />
      <Text style={styles.label}>Напомнить:</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 1440 && styles.selectedButton,
          ]}
          onPress={() => handleNotificationOption(1440)}
        >
          <Text>За день</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 60 && styles.selectedButton,
          ]}
          onPress={() => handleNotificationOption(60)}
        >
          <Text>За час</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 15 && styles.selectedButton,
          ]}
          onPress={() => handleNotificationOption(15)}
        >
          <Text>За 15 минут</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Создать" onPress={handleSubmit} />
      )}
    </View>
  );
};

// Описание стилей
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  notificationButton: {
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  selectedButton: {
    backgroundColor: "#dcdcdc",
  },
  errorText: {
    color: "red",
    marginBottom: 16,
    textAlign: "center",
  },
});

export default CreateSubscriptionScreen;
