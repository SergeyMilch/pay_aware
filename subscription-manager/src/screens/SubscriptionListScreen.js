import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  getSubscriptions,
  deleteSubscription,
  initializeAuthToken,
} from "../api/api";
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService"; // Импорт navigationRef

const SubscriptionListScreen = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  const isFocused = useIsFocused();

  const fetchSubscriptions = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
        return;
      }

      setLoading(true);
      const data = await getSubscriptions();
      logger.log("Полученные подписки:", data);
      setSubscriptions(data);
      calculateTotalCost(data);
    } catch (error) {
      if (error.message === "SessionExpired") {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.error("Ошибка при загрузке подписок:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = (subscriptions) => {
    const cost = subscriptions.reduce((sum, subscription) => {
      return sum + (subscription.cost || 0);
    }, 0);
    setTotalCost(cost);
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          initializeAuthToken(token);
          fetchSubscriptions();
        } else {
          if (navigationRef.isReady()) {
            navigationRef.navigate("Login");
          }
        }
      } catch (error) {
        logger.error("Ошибка при инициализации токена:", error);
      }
    };

    if (isFocused) {
      initializeData();
    }
  }, [isFocused]);

  const handleDelete = async (id) => {
    if (!id) {
      logger.error("Идентификатор подписки отсутствует");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        if (navigationRef.isReady()) {
          navigationRef.navigate("Login");
        }
        return;
      }

      await deleteSubscription(id);
      logger.log(`Подписка с ID ${id} успешно удалена`);
      await fetchSubscriptions();
    } catch (error) {
      logger.error("Ошибка при удалении подписки:", error);
    }
  };

  const handleAddSubscription = async () => {
    const token = await AsyncStorage.getItem("authToken");
    if (!token) {
      Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login");
      }
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate("CreateSubscription");
    }
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
      <View style={styles.totalCostContainer}>
        <Text style={styles.totalCostText}>
          Общая стоимость: {totalCost.toFixed(2)} ₽
        </Text>
      </View>

      <FlatList
        data={subscriptions}
        keyExtractor={(item, index) =>
          item?.ID ? item.ID.toString() : index.toString()
        }
        renderItem={({ item }) => {
          const now = new Date();
          const isReminderTime = new Date(item.notification_date) <= now;

          return (
            <View style={styles.subscriptionItem}>
              <TouchableOpacity
                onPress={() =>
                  navigationRef.isReady() &&
                  navigationRef.navigate("SubscriptionDetail", {
                    subscription: item,
                  })
                }
                style={styles.subscriptionDetails}
              >
                <View style={styles.subscriptionInfoContainer}>
                  <Text style={styles.subscriptionName} numberOfLines={2}>
                    {item?.service_name}
                  </Text>
                  {isReminderTime && (
                    <View style={styles.reminder}>
                      <Text style={styles.reminderText}>!</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.subscriptionPrice}>
                  ${item?.cost.toFixed(2)}
                </Text>
              </TouchableOpacity>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.editButton]}
                  onPress={() =>
                    navigationRef.isReady() &&
                    navigationRef.navigate("EditSubscription", {
                      subscriptionId: item.ID,
                    })
                  }
                >
                  <Text style={styles.buttonText}>Редактировать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => handleDelete(item.ID)}
                >
                  <Text style={styles.buttonText}>Удалить</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddSubscription}
      >
        <Text style={styles.addButtonText}>Добавить подписку</Text>
      </TouchableOpacity>
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
  totalCostContainer: {
    alignSelf: "center",
    padding: 12,
    backgroundColor: "#FFD700",
    borderRadius: 8,
    marginBottom: 16,
    width: "80%",
  },
  totalCostText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  subscriptionItem: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
  },
  subscriptionInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  subscriptionDetails: {
    marginBottom: 8,
  },
  subscriptionName: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  subscriptionPrice: {
    fontSize: 16,
    color: "#888",
    textAlign: "right",
  },
  reminder: {
    marginLeft: 10,
    backgroundColor: "red",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderText: {
    color: "white",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  editButton: {
    backgroundColor: "#007bff",
  },
  deleteButton: {
    backgroundColor: "red",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  addButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#FFD700",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default SubscriptionListScreen;
