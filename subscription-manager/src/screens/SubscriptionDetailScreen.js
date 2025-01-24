import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import logger from "../utils/logger";
import Icon from "react-native-vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { useNavigation } from "@react-navigation/native";
import { navigationRef } from "../navigation/navigationService";
import { deleteSubscription, initializeAuthToken } from "../api/api";

/**
 * Экран деталей подписки.
 * Теперь тут есть:
 * - Название, цена
 * - Следующий платёж (конкретная дата)
 * - Тег
 * - Кнопки "Редактировать" и "Удалить"
 */
const SubscriptionDetailScreen = ({ route }) => {
  const { subscription, availableTags } = route.params || {};
  const navigation = useNavigation();

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

  // Подтверждение удаления
  const confirmDelete = (id) => {
    Alert.alert(
      "Удаление подписки",
      "Вы уверены, что хотите удалить эту подписку?",
      [
        {
          text: "Нет",
          style: "cancel",
        },
        {
          text: "Да",
          onPress: () => handleDelete(id),
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  // Удаление
  const handleDelete = async (id) => {
    if (!id) {
      logger.error("Идентификатор подписки отсутствует, удаление невозможно");
      return;
    }
    try {
      logger.log(`Попытка удалить подписку с ID: ${id}`);
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        if (navigationRef.isReady()) {
          navigationRef.navigate("Login");
        }
        return;
      }
      initializeAuthToken(token); // Инициализируем заголовки с токеном
      await deleteSubscription(id);
      logger.log(`Подписка с ID ${id} успешно удалена`);
      // После удаления возвращаемся на предыдущий экран (список)
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else if (navigationRef.isReady()) {
        navigationRef.navigate("SubscriptionList");
      }
    } catch (error) {
      logger.error("Ошибка при удалении подписки:", error);
    }
  };

  // Редактирование
  const handleEdit = () => {
    logger.log(
      `Переход на экран редактирования подписки с ID: ${subscription.ID}`
    );
    if (navigationRef.isReady()) {
      navigationRef.navigate("EditSubscription", {
        subscriptionId: subscription.ID,
        availableTags, // передадим теги
      });
    }
  };

  // Преобразуем даты в удобочитаемый формат
  const nextPaymentDateString = subscription.next_payment_date
    ? new Date(subscription.next_payment_date).toLocaleString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Не указана";
  const createdAtString = subscription.CreatedAt
    ? new Date(subscription.CreatedAt).toLocaleString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Не указана";

  return (
    <View style={styles.container}>
      {/* Название сервиса */}
      <Text style={styles.title}>{subscription.service_name}</Text>

      {/* Стоимость */}
      <View style={styles.infoRow}>
        <Text style={styles.label}>Стоимость:</Text>
        <Text style={styles.value}>{subscription.cost.toFixed(2)} ₽</Text>
      </View>

      {/* Тег (если есть) */}
      {subscription.tag ? (
        <View style={styles.infoRow}>
          <Icon
            name="bookmark-outline"
            size={16}
            color="#444"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.value}>{subscription.tag}</Text>
        </View>
      ) : null}

      {/* Дата следующего платежа */}
      <View style={styles.infoRow}>
        <Text style={styles.label}>Следующий платеж:</Text>
        <Text style={styles.value}>{nextPaymentDateString}</Text>
      </View>

      {/* Дата создания (CreatedAt) */}
      <View style={styles.infoRow}>
        <Text style={styles.label}>Дата создания:</Text>
        <Text style={styles.value}>{createdAtString}</Text>
      </View>

      {/* Кнопки "Редактировать" / "Удалить" */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={handleEdit}
        >
          <Text style={styles.buttonText}>Редактировать</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => confirmDelete(subscription.ID)}
        >
          <Text style={styles.buttonText}>Удалить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SubscriptionDetailScreen;

/** Стили для SubscriptionDetailScreen */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 24,
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  editButton: {
    backgroundColor: "#7b6dae",
  },
  deleteButton: {
    backgroundColor: "tomato",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
