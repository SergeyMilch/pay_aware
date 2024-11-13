import React from "react";
import { View, Text, StyleSheet } from "react-native";
import logger from "../utils/logger"; // Импорт логгера

const SubscriptionDetailScreen = ({ route }) => {
  const { subscription } = route.params;

  if (!subscription) {
    logger.error("Данные подписки отсутствуют в параметрах маршрута.");
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Ошибка: данные подписки не найдены.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{subscription.service_name}</Text>
      <Text style={styles.price}>
        Стоимость: {subscription.cost.toFixed(2)}
      </Text>
      <Text style={styles.detail}>
        Дата создания: {new Date(subscription.CreatedAt).toLocaleString()}
      </Text>
      <Text style={styles.detail}>
        Следующий платеж:{" "}
        {new Date(subscription.next_payment_date).toLocaleString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  price: {
    fontSize: 18,
    color: "#333",
  },
  detail: {
    fontSize: 16,
    color: "#555",
    marginTop: 8,
  },
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
  },
});

export default SubscriptionDetailScreen;
