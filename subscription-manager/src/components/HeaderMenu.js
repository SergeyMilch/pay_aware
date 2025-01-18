import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Menu, Button } from "react-native-paper";

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
