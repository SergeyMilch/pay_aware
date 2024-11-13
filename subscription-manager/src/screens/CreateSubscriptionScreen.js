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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "../navigation/navigationService";

const CreateSubscriptionScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationOffset, setNotificationOffset] = useState(null);

  // Проверка токена при загрузке экрана
  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      }
    };
    checkToken();
  }, []);

  const handlePriceChange = (text) => {
    const formattedText = text.replace(",", ".");
    if (isValidPrice(formattedText)) {
      setPrice(formattedText);
    }
  };
  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    // Проверка входных данных перед отправкой
    if (!isValidName(name)) {
      setError("Название подписки содержит недопустимые символы.");
      setLoading(false);
      return;
    }

    const parsedPrice = parseFloat(parseFloat(price).toFixed(2));
    if (isNaN(parsedPrice)) {
      setError("Введите корректную стоимость подписки.");
      setLoading(false);
      return;
    }

    try {
      // Проверка токена перед отправкой
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
        return;
      }

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
        setError("Не удалось создать подписку. Попробуйте еще раз.");
        logger.warn("Ответ от сервера не содержит ID подписки:", response);
      }
    } catch (error) {
      if (error.message === "SessionExpired") {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.error("Ошибка при создании подписки:", error);
        setError("Не удалось создать подписку. Попробуйте еще раз.");
      }
    } finally {
      setLoading(false);
    }
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    setNextPaymentDate(date);
    hideDatePicker();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Название сервиса</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
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
          value={nextPaymentDate.toDateString()}
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
      <Text style={styles.label}>Интервал напоминания</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 1440 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(1440)}
        >
          <Text>За день</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 60 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(60)}
        >
          <Text>За час</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 15 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(15)}
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
