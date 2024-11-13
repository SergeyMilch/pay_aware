import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useFocusEffect } from "@react-navigation/native";
import { getSubscriptionById, updateSubscription } from "../api/api";
import logger from "../utils/logger";
import { isValidName, isValidPrice } from "../utils/validation"; // Импорт функций валидации

const EditSubscriptionScreen = ({ route, navigation }) => {
  const { subscriptionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [serviceName, setServiceName] = useState("");
  const [cost, setCost] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState("");
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const handleCostChange = (text) => {
    const formattedText = text.replace(",", ".");
    if (isValidPrice(formattedText)) {
      setCost(formattedText);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchSubscription = async () => {
        try {
          const data = await getSubscriptionById(subscriptionId);
          setServiceName(data.service_name);
          setCost(data.cost.toString());
          setNextPaymentDate(data.next_payment_date);
          setNotificationOffset(data.notification_offset);
          logger.log("Подписка загружена успешно:", data);
        } catch (error) {
          logger.error("Ошибка при загрузке подписки:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchSubscription();
    }, [subscriptionId])
  );

  const handleSave = async () => {
    // Проверка корректности данных
    if (!isValidName(serviceName)) {
      alert("Название содержит недопустимые символы.");
      return;
    }
    const formattedCost = Number(parseFloat(cost).toFixed(2));
    if (isNaN(formattedCost) || !isValidPrice(cost)) {
      alert("Введите корректную стоимость подписки.");
      return;
    }

    try {
      const nextPaymentDateObject = new Date(nextPaymentDate);

      const updatedData = {
        service_name: serviceName,
        cost: formattedCost,
        next_payment_date: nextPaymentDateObject.toISOString(),
        notification_offset: notificationOffset,
      };

      await updateSubscription(subscriptionId, updatedData);
      navigation.goBack();
    } catch (error) {
      logger.error("Ошибка при обновлении подписки:", error);
    }
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    const formattedDate = date.toISOString();
    setNextPaymentDate(formattedDate);
    hideDatePicker();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={serviceName}
        onChangeText={setServiceName}
        placeholder="Название сервиса"
      />
      <TextInput
        style={styles.input}
        value={cost}
        onChangeText={handleCostChange}
        placeholder="Стоимость"
        keyboardType="numeric"
      />
      {Platform.OS === "web" ? (
        <TextInput
          type="date"
          style={styles.input}
          value={nextPaymentDate}
          onChangeText={setNextPaymentDate}
          placeholder="Дата следующего платежа (например, 2024-11-15)"
        />
      ) : (
        <TouchableOpacity onPress={showDatePicker}>
          <TextInput
            style={styles.input}
            value={nextPaymentDate}
            placeholder="Дата следующего платежа (например, 2024-11-15)"
            editable={false}
          />
        </TouchableOpacity>
      )}
      <View style={styles.notificationContainer}>
        <Text>Напомнить за:</Text>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 1440 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(1440)}
        >
          <Text style={styles.buttonText}>1 день</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 60 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(60)}
        >
          <Text style={styles.buttonText}>1 час</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.notificationButton,
            notificationOffset === 15 && styles.selectedButton,
          ]}
          onPress={() => setNotificationOffset(15)}
        >
          <Text style={styles.buttonText}>15 минут</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Сохранить</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
  },
  notificationContainer: {
    marginVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notificationButton: {
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  selectedButton: {
    backgroundColor: "#dcdcdc",
  },
  buttonText: {
    color: "#000",
  },
  saveButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default EditSubscriptionScreen;
