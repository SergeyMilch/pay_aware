import React, { useEffect, useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { getSubscriptions, initializeAuthToken } from "../api/api";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService";
import HeaderMenu from "../components/HeaderMenu";
import { getNextPaymentText } from "../utils/dateCalculation";

const SubscriptionListScreen = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  // !!! Новый стейт, чтобы "текущее время" обновлялось
  const [currentTime, setCurrentTime] = useState(new Date());

  // Массив уникальных тегов
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");

  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const route = useRoute();

  // Функция сортировки подписок по дате платежа
  const sortSubscriptionsByDate = (subs, order = "asc") => {
    return subs.sort((a, b) => {
      const dateA = a.next_payment_date
        ? new Date(a.next_payment_date)
        : new Date(0);
      const dateB = b.next_payment_date
        ? new Date(b.next_payment_date)
        : new Date(0);
      return order === "asc" ? dateA - dateB : dateB - dateA;
    });
  };

  // При возвращении с TagFilterScreen
  useEffect(() => {
    if (route.params?.newSelectedTag !== undefined) {
      setSelectedTag(route.params.newSelectedTag);
      navigation.setParams({ newSelectedTag: undefined });
    }
  }, [route.params?.newSelectedTag]);

  // !!! useEffect, который каждую минуту обновляет currentTime
  useEffect(() => {
    // Запускаем таймер, обновляющий стейт раз в 60 секунд
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      clearInterval(timer); // при размонтировании
    };
  }, []);

  // useEffect на фокус (загрузка подписок)
  useEffect(() => {
    const initializeData = async () => {
      try {
        logger.log("Инициализация данных и проверка токена");
        const token = await SecureStore.getItemAsync("authToken");
        if (token) {
          logger.log("Токен найден, инициализация API с токеном");
          initializeAuthToken(token);
          await fetchSubscriptions();
        } else {
          logger.warn("Токен не найден, перенаправляем на экран логина");
          if (navigationRef.isReady()) {
            navigationRef.navigate("Login");
          }
        }
      } catch (error) {
        logger.error("Ошибка при инициализации токена:", error);
      }
    };

    if (isFocused) {
      if (route.params?.skipRefresh) {
        navigation.setParams({ skipRefresh: false });
      } else {
        initializeData();
      }
    }
  }, [isFocused]);

  // Настраиваем HeaderMenu (headerRight)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderMenu
          navigation={navigation}
          availableTags={availableTags}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
        />
      ),
    });
  }, [navigation, availableTags, selectedTag]);

  const fetchSubscriptions = async () => {
    try {
      logger.log("Начало загрузки подписок");
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
        return;
      }

      setLoading(true);
      const data = await getSubscriptions();
      logger.log(
        "Подписки успешно загружены. Количество подписок:",
        data.length
      );

      // Сортируем подписки
      const sortedData = sortSubscriptionsByDate([...data], "asc");
      setSubscriptions(sortedData);

      // Собираем уникальные теги
      const tagsSet = new Set();
      data.forEach((sub) => {
        if (sub.tag) tagsSet.add(sub.tag);
      });
      setAvailableTags(Array.from(tagsSet));

      // Считаем общую стоимость
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

  const calculateTotalCost = (subs) => {
    const cost = subs.reduce((sum, subscription) => {
      return sum + (subscription.cost || 0);
    }, 0);
    setTotalCost(cost);
  };

  // Фильтрация подписок по тегу
  const filteredSubscriptions = selectedTag
    ? subscriptions.filter((sub) => sub.tag === selectedTag)
    : subscriptions;

  // При каждом изменении filteredSubscriptions пересчитываем стоимость
  useEffect(() => {
    calculateTotalCost(filteredSubscriptions);
  }, [filteredSubscriptions]);

  // Добавление
  const handleAddSubscription = async () => {
    logger.log("Переход на экран создания подписки");
    const token = await SecureStore.getItemAsync("authToken");
    if (!token) {
      Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login");
      }
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate("CreateSubscription", {
        availableTags,
      });
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
      {/* Блок с общей стоимостью */}
      <View style={styles.totalCostContainer}>
        <Text style={styles.totalCostText}>
          Общая стоимость: {totalCost.toFixed(2)} ₽
        </Text>

        {/* Показ, какой тег выбран (если есть) */}
        {selectedTag && (
          <View style={{ marginTop: 5 }}>
            <Text style={{ fontStyle: "italic" }}>
              Отфильтровано по тегу:{" "}
              <Text style={{ fontWeight: "bold" }}>{selectedTag}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedTag("")}
              style={{
                marginTop: 5,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "#7b6dae",
                borderRadius: 4,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#fff" }}>Сбросить фильтр</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={filteredSubscriptions}
        keyExtractor={(item, index) =>
          item?.ID ? item.ID.toString() : index.toString()
        }
        renderItem={({ item }) => {
          // Показываем воскл. знак, если уже пора напоминать
          const now = new Date();
          const isReminderTime =
            item.notification_date && new Date(item.notification_date) <= now;

          return (
            <View style={styles.subscriptionItem}>
              {/* Верхняя строка: Название (с кликом к деталям) + "!" + Цена */}
              <View style={styles.topRow}>
                <View style={styles.leftContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      navigationRef.isReady() &&
                        navigationRef.navigate("SubscriptionDetail", {
                          subscription: item,
                          availableTags,
                        });
                    }}
                  >
                    <Text style={styles.subscriptionName} numberOfLines={2}>
                      {item?.service_name}
                    </Text>
                  </TouchableOpacity>

                  {isReminderTime && (
                    <View style={styles.reminder}>
                      <Text style={styles.reminderText}>!</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rightContainer}>
                  <Text style={styles.subscriptionPrice}>
                    {item?.cost.toFixed(2)} ₽
                  </Text>
                </View>
              </View>

              {/* Нижняя строка: справа - "До платежа осталось X..." */}
              <View style={styles.bottomRow}>
                <View style={{ flex: 1 }} />
                {item.next_payment_date && (
                  <Text style={styles.nextPaymentText}>
                    {/** Передаем currentTime во вторую функцию для пересчёта */}
                    {getNextPaymentText(item.next_payment_date, currentTime)}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddSubscription}
      >
        <Text style={styles.addButtonText}>Добавить напоминание</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SubscriptionListScreen;

/** Стили */
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
    backgroundColor: "#d5d2ec",
    borderRadius: 8,
    marginBottom: 16,
  },
  totalCostText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  subscriptionItem: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftContainer: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  subscriptionName: {
    fontSize: 18,
    fontWeight: "bold",
    flexShrink: 1,
    textDecorationLine: "underline",
  },
  reminder: {
    marginLeft: 6,
    backgroundColor: "red",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderText: {
    color: "#fff",
    fontWeight: "bold",
  },
  rightContainer: {
    flex: 0,
    marginLeft: 8,
    alignItems: "flex-end",
  },
  subscriptionPrice: {
    fontSize: 16,
    fontWeight: "500",
    color: "#7b6dae",
  },
  bottomRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  nextPaymentText: {
    fontSize: 14,
    color: "#444",
    textAlign: "right",
  },
  addButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#d5d2ec",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
});
