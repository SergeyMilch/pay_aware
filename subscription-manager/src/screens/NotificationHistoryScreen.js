import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { getUserNotifications, markNotificationAsRead } from "../api/api";
import logger from "../utils/logger";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const NotificationHistoryScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState("");
  const navigation = useNavigation();

  useEffect(() => {
    logger.log("useEffect вызван: Инициализация fetchNotifications");
    fetchNotifications(true);
  }, []);

  const fetchNotifications = async (refresh = false) => {
    logger.log(
      "fetchNotifications вызван. refresh:",
      refresh,
      "loading:",
      loading,
      "hasMore:",
      hasMore
    );

    if (loading || (!refresh && !hasMore)) {
      logger.log("fetchNotifications пропущен из-за условий.");
      return;
    }

    try {
      logger.log("Начало запроса getUserNotifications");
      if (refresh) {
        setRefreshing(true);
        setOffset(0); // Сброс offset при обновлении
      } else {
        setLoading(true);
      }

      const currentOffset = refresh ? 0 : offset;
      const data = await getUserNotifications({ limit, offset: currentOffset });
      logger.log("Ответ от getUserNotifications:", data);

      if (refresh) {
        setNotifications(data);
      } else {
        setNotifications((prev) => [...prev, ...data]);
      }

      setHasMore(data.length >= limit); // Если данных меньше лимита, больше нечего загружать
      setOffset(currentOffset + data.length); // Увеличиваем offset только на длину полученных данных
    } catch (error) {
      logger.error("Ошибка при запросе уведомлений:", error);
      Alert.alert("Ошибка", "Не удалось загрузить уведомления.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setHasMore(true);
    fetchNotifications(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications();
    }
  };

  const handleNotificationPress = async (item) => {
    if (item.read_at) {
      logger.log("Уведомление уже прочитано:", item.ID);
      return;
    }

    try {
      logger.log("Отмечаем уведомление как прочитанное:", item.ID);
      await markNotificationAsRead(item.ID);

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.ID === item.ID
            ? { ...notif, read_at: new Date().toISOString() }
            : notif
        )
      );

      if (item.subscription_id && item.subscription) {
        navigation.navigate("SubscriptionDetail", {
          subscription: item.subscription,
        });
      } else {
        logger.warn("Уведомление не связано с подпиской:", item.ID);
      }
    } catch (error) {
      logger.error("Ошибка при отметке уведомления как прочитанного:", error);
    }
  };

  const renderItem = ({ item }) => {
    const { message, sent_at, subscription, read_at } = item;
    const date = new Date(sent_at).toLocaleString();
    const isRead = read_at !== null;

    return (
      <TouchableOpacity
        onPress={() => {
          if (!isRead) {
            handleNotificationPress(item);
            if (item.subscription_id) {
              navigation.navigate("SubscriptionDetail", {
                subscription: item.subscription,
              });
            }
          }
        }}
        style={[
          styles.notificationItem,
          isRead && styles.readNotificationItem, // Серый фон для прочитанных
        ]}
        disabled={isRead} // Отключаем кликабельность для прочитанных
      >
        <View style={styles.notificationHeader}>
          <Text style={[styles.subscriptionName, !isRead && styles.unread]}>
            {subscription?.service_name || "Неизвестный сервис"}
          </Text>
          <Text style={styles.sentAt}>{date}</Text>
        </View>
        <Text style={styles.message}>{message}</Text>
      </TouchableOpacity>
    );
  };

  //   const renderItem = ({ item }) => {
  //     const { message, sent_at, subscription, read_at } = item;
  //     const date = new Date(sent_at).toLocaleString();
  //     const isRead = read_at !== null; // Корректная проверка на наличие даты прочтения

  //     return (
  //       <TouchableOpacity
  //         onPress={!isRead ? () => handleNotificationPress(item) : null} // Только для непрочитанных
  //         style={[
  //           styles.notificationItem,
  //           isRead && styles.readNotificationItem, // Серый фон для прочитанных
  //         ]}
  //         disabled={isRead} // Отключаем кликабельность для прочитанных
  //       >
  //         <View style={styles.notificationHeader}>
  //           <Text style={[styles.subscriptionName, !isRead && styles.unread]}>
  //             {subscription?.service_name || "Неизвестный сервис"}
  //           </Text>
  //           <Text style={styles.sentAt}>{date}</Text>
  //         </View>
  //         <Text style={styles.message}>{message}</Text>
  //       </TouchableOpacity>
  //     );
  //   };

  const renderFooter = () => {
    if (!loading || !hasMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  };

  const filteredNotifications = notifications.filter((notif) =>
    notif.message.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#888" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск уведомлений"
          value={filter}
          onChangeText={setFilter}
        />
      </View>
      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет уведомлений</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.ID.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationItem: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
  },
  readNotificationItem: {
    backgroundColor: "#e0e0e0", // Серый фон для прочитанных уведомлений
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subscriptionName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  sentAt: {
    fontSize: 14,
    color: "#888",
  },
  message: {
    fontSize: 14,
    color: "#333",
  },
  unread: {
    fontWeight: "bold",
    color: "#000", // Черный текст для непрочитанных
  },
  footer: {
    paddingVertical: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  emptyText: {
    fontSize: 18,
    color: "#888",
    textAlign: "center",
  },
});

export default NotificationHistoryScreen;
