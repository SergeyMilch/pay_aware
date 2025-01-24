import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Menu, Button } from "react-native-paper";
import * as SecureStore from "expo-secure-store";
import { logoutUser, deleteUserAccount } from "../api/api";

/**
 * Компонент HeaderMenu.
 *
 * Пропсы:
 * - navigation: для навигации
 * - availableTags: массив тегов
 * - selectedTag: текущий выбранный тег
 */
const HeaderMenu = ({ navigation, availableTags, selectedTag }) => {
  const [mainMenuVisible, setMainMenuVisible] = useState(false);

  const openMainMenu = () => setMainMenuVisible(true);
  const closeMainMenu = () => setMainMenuVisible(false);

  // Обработчик логаута
  const handleLogout = async () => {
    try {
      closeMainMenu();
      // Подтверждение удаления (диалог)
      Alert.alert("Подтвердите выход", "Вы действительно хотите выйти?", [
        { text: "Отмена", style: "cancel" },
        {
          text: "OK",
          style: "destructive",
          onPress: async () => {
            try {
              // Вызываем логаут на сервере
              await logoutUser();

              // Чистим локальные данные
              await SecureStore.deleteItemAsync("authToken");
              // await SecureStore.deleteItemAsync("userId");
              // await SecureStore.deleteItemAsync("deviceToken");
              // await SecureStore.deleteItemAsync("pinCode");

              // Переходим на экран логина (или "Register", как хотите)
              navigation.navigate("EnterPinScreen");
            } catch (error) {
              Alert.alert("Ошибка", "Не удалось выйти");
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось выйти");
    }
  };

  // Обработчик удаления аккаунта
  const handleDeleteAccount = async () => {
    try {
      closeMainMenu();

      // Подтверждение удаления (диалог)
      Alert.alert(
        "Подтвердите удаление",
        "Вы действительно хотите удалить аккаунт и все данные?",
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "OK",
            style: "destructive",
            onPress: async () => {
              try {
                // Запрос на сервер
                await deleteUserAccount();

                // Локально всё стираем
                await SecureStore.deleteItemAsync("authToken");
                await SecureStore.deleteItemAsync("userId");
                await SecureStore.deleteItemAsync("deviceToken");
                await SecureStore.deleteItemAsync("pinCode");

                // Переходим на экран регистрации (или логина)
                navigation.navigate("Register");
              } catch (err) {
                Alert.alert("Ошибка", "Не удалось удалить аккаунт");
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось удалить аккаунт");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.menuContainer}>
        <Menu
          visible={mainMenuVisible}
          onDismiss={closeMainMenu}
          anchor={
            <Button
              icon="menu"
              mode="contained"
              onPress={openMainMenu}
              contentStyle={{ backgroundColor: "#e5e5e5" }}
              labelStyle={{ color: "#000" }}
            >
              Меню
            </Button>
          }
          style={styles.menu}
        >
          {/* Пункт "История уведомлений" */}
          <Menu.Item
            onPress={() => {
              closeMainMenu();
              navigation.navigate("NotificationHistory");
            }}
            title="История уведомлений"
          />

          {/* Пункт "Фильтр по тегам" -> просто переходим на экран TagFilterScreen */}
          <Menu.Item
            onPress={() => {
              closeMainMenu();
              navigation.navigate("TagFilterScreen", {
                availableTags, // Можем передать теги
                selectedTag, // И текущий выбранный тег
                skipRefresh: true,
              });
            }}
            title="Фильтр по тегам"
          />
          {/* --- Разделитель (опционально) --- */}
          <Menu.Item
            // Можно стилизовать как divider, но в React Native Paper для Menu.Item
            // нет встроенного разделителя, поэтому можно просто
            // добавить Menu.Item с "_____"
            title="______________________________"
            disabled={true}
          />

          {/* 3. Выйти */}
          <Menu.Item onPress={handleLogout} title="Выйти" />

          {/* 4. Удалить аккаунт */}
          <Menu.Item onPress={handleDeleteAccount} title="Удалить аккаунт" />
        </Menu>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Обычно flex:1 для фона не нужно
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  menuContainer: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 16,
  },
  menu: {
    marginTop: 50,
    backgroundColor: "white",
    borderRadius: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default HeaderMenu;
