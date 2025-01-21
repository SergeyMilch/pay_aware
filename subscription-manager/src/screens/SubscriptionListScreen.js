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

  // Удаление
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

      await deleteSubscription(id);
      logger.log(`Подписка с ID ${id} успешно удалена`);
      await fetchSubscriptions();
    } catch (error) {
      logger.error("Ошибка при удалении подписки:", error);
    }
  };

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
          const isReminderTime = new Date(item.notification_date) <= now;

          return (
            <View style={styles.subscriptionItem}>
              <TouchableOpacity
                onPress={() => {
                  logger.log(
                    `Переход на экран деталей подписки с ID: ${item.ID}`
                  );
                  navigationRef.isReady() &&
                    navigationRef.navigate("SubscriptionDetail", {
                      subscription: item,
                    });
                }}
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
                  {item?.cost.toFixed(2)} ₽
                </Text>
                {/* Показываем тег и дату платежа, если есть */}
                {(item?.tag || item.next_payment_date) && (
                  <View style={styles.tagDateContainer}>
                    <View style={styles.tagContainer}>
                      {item.tag ? (
                        <>
                          <Icon
                            name="bookmark-outline"
                            size={16}
                            color="#444"
                            style={styles.iconStyle}
                          />
                          <Text style={styles.tagText}>{item.tag}</Text>
                        </>
                      ) : (
                        <View style={styles.placeholder} />
                      )}
                    </View>
                    <View style={styles.dateContainer}>
                      {item.next_payment_date ? (
                        <>
                          <Icon
                            name="card-outline"
                            size={16}
                            color="#444"
                            style={styles.iconStyle}
                          />
                          <Text style={styles.dateText}>
                            {new Date(
                              item.next_payment_date
                            ).toLocaleDateString("ru-RU", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </Text>
                        </>
                      ) : (
                        <View style={styles.placeholder} />
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.editButton]}
                  onPress={() => {
                    logger.log(
                      `Переход на экран редактирования подписки с ID: ${item.ID}`
                    );
                    navigationRef.isReady() &&
                      navigationRef.navigate("EditSubscription", {
                        subscriptionId: item.ID,
                        availableTags: availableTags, // <-- то же самое передаём availableTags
                      });
                  }}
                >
                  <Text style={styles.buttonText}>Редактировать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => confirmDelete(item.ID)}
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
    // width: "80%",
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
  tagDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  tagContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1, // Занимает всё доступное пространство слева
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    // flex: 0, // По умолчанию flex: 0
  },
  iconStyle: {
    marginRight: 4,
  },
  tagText: {
    fontSize: 14,
    color: "#444",
  },
  dateText: {
    fontSize: 14,
    color: "#444",
  },
  placeholder: {
    width: 20, // Ширина иконки, чтобы сохранить выравнивание
    height: 20,
  },
});

export default SubscriptionListScreen;
