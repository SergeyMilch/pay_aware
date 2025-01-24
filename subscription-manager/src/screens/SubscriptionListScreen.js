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
import {
  getSubscriptions,
  deleteSubscription,
  initializeAuthToken,
} from "../api/api";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import logger from "../utils/logger";
import { navigationRef } from "../navigation/navigationService"; // Импорт navigationRef
import HeaderMenu from "../components/HeaderMenu"; // <-- чтобы динамически рендерить в header
import Icon from "react-native-vector-icons/Ionicons";

/** Функция для склонения (дней, месяцев, лет) */
function declOfNum(number, titles) {
  number = Math.abs(number);
  const n = number % 100;
  if (n >= 5 && n <= 20) {
    return titles[2];
  }
  const n1 = number % 10;
  if (n1 === 1) {
    return titles[0];
  }
  if (n1 >= 2 && n1 <= 4) {
    return titles[1];
  }
  return titles[2];
}

/** Функция, которая возвращает строку вида:
 * "следующий платёж через 5 дней" / "через 1 месяц" / "через 2 года" и т.д.
 */
function getNextPaymentText(dateString) {
  if (!dateString) return "Нет данных";
  const now = new Date();
  const nextPayment = new Date(dateString);
  const diffMs = nextPayment - now;

  if (diffMs <= 0) {
    return "Просрочено";
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 31) {
    const dWord = declOfNum(diffDays, ["день", "дня", "дней"]);
    return `следующий платёж через ${diffDays} ${dWord}`;
  } else if (diffDays < 365) {
    const diffMonths = Math.ceil(diffDays / 30);
    const mWord = declOfNum(diffMonths, ["месяц", "месяца", "месяцев"]);
    return `следующий платёж через ${diffMonths} ${mWord}`;
  } else {
    const diffYears = Math.ceil(diffDays / 365);
    const yWord = declOfNum(diffYears, ["год", "года", "лет"]);
    return `следующий платёж через ${diffYears} ${yWord}`;
  }
}

const SubscriptionListScreen = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  // Для фильтра по тегам
  const [availableTags, setAvailableTags] = useState([]); // Массив уникальных тегов
  const [selectedTag, setSelectedTag] = useState(""); // Текущий выбранный тег

  // Хук, чтобы узнать, фокусирован ли экран
  const isFocused = useIsFocused();

  // Хук, чтобы получить доступ к navigation (для setOptions)
  const navigation = useNavigation();

  const route = useRoute(); // чтобы ловить params

  // Функция сортировки подписок по дате платежа
  const sortSubscriptionsByDate = (subscriptions, order = "asc") => {
    return subscriptions.sort((a, b) => {
      const dateA = a.next_payment_date
        ? new Date(a.next_payment_date)
        : new Date(0);
      const dateB = b.next_payment_date
        ? new Date(b.next_payment_date)
        : new Date(0);

      if (order === "asc") {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });
  };

  // При возвращении с TagFilterScreen, если newSelectedTag есть -> применяем
  useEffect(() => {
    if (route.params?.newSelectedTag !== undefined) {
      setSelectedTag(route.params.newSelectedTag);
      // Чтобы не срабатывало повторно, сбрасываем
      navigation.setParams({ newSelectedTag: undefined });
    }
  }, [route.params?.newSelectedTag]);

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
      // Если skipRefresh === true, то пропускаем перезагрузку
      if (route.params?.skipRefresh) {
        // Например, просто сбросим этот параметр, чтобы он не "застрял"
        navigation.setParams({ skipRefresh: false });
        // И не вызываем fetchSubscriptions -> значит не будет мигать
      } else {
        // Обычная логика, которая была: грузим подписки
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
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
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
      setSubscriptions(data);

      // Сортируем подписки по дате платежа (по возрастанию)
      const sortedData = sortSubscriptionsByDate([...data], "asc"); // Копируем массив, чтобы избежать мутации оригинала
      setSubscriptions(sortedData);

      // Собираем уникальные теги
      const tagsSet = new Set();
      data.forEach((sub) => {
        if (sub.tag) {
          tagsSet.add(sub.tag);
        }
      });
      setAvailableTags(Array.from(tagsSet));

      // По умолчанию считаем общую стоимость (без фильтра)
      calculateTotalCost(data);
    } catch (error) {
      if (error.message === "SessionExpired") {
        logger.warn("Сессия истекла, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.error("Ошибка при загрузке подписок:", error);
      }
    } finally {
      setLoading(false);
      logger.log("Загрузка подписок завершена");
    }
  };

  // Расчет стоимости
  const calculateTotalCost = (subscriptions) => {
    logger.log("Начинаем расчет общей стоимости подписок");
    const cost = subscriptions.reduce((sum, subscription) => {
      return sum + (subscription.cost || 0);
    }, 0);
    setTotalCost(cost);
    logger.log("Общая стоимость подписок:", cost);
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
      logger.warn("Токен отсутствует, перенаправляем на экран логина");
      Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
      if (navigationRef.isReady()) {
        navigationRef.navigate("Login");
      }
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate("CreateSubscription", {
        availableTags: availableTags, // <-- передаём availableTags вместе
      });
    }
  };

  // Рендер
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Отображаем текущую общую стоимость (именно отфильтрованных) */}
      <View style={styles.totalCostContainer}>
        <Text style={styles.totalCostText}>
          Общая стоимость: {totalCost.toFixed(2)} ₽
        </Text>

        {/* Показываем, какой тег выбран */}
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
          const now = new Date();
          const isReminderTime =
            item.notification_date && new Date(item.notification_date) <= now;

          return (
            <View style={styles.subscriptionItem}>
              {/* Верхняя строка: Название + воскл. знак слева, Цена справа */}
              <View style={styles.topRow}>
                <View style={styles.leftContainer}>
                  {/* 
                    Оборачиваем название в TouchableOpacity, 
                    чтобы перейти на экран деталей только при клике на текст 
                  */}
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

              {/* Нижняя строка: справа текст "следующий платёж через X дней" */}
              <View style={styles.bottomRow}>
                <View style={{ flex: 1 }} />
                {item.next_payment_date && (
                  // Убираем TouchableOpacity, оставляем просто Text
                  <Text style={styles.nextPaymentText}>
                    {getNextPaymentText(item.next_payment_date)}
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
  resetFilterButton: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#7b6dae",
    borderRadius: 4,
    alignSelf: "flex-start",
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
    textDecorationLine: "underline", // <-- добавили подчеркивание
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
    color: "#888",
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

export default SubscriptionListScreen;
