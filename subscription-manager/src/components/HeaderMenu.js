import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Menu, Button } from "react-native-paper";

const HeaderMenu = ({ navigation }) => {
  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  return (
    <View style={styles.container}>
      <View style={styles.menuContainer}>
        <Menu
          visible={visible}
          onDismiss={closeMenu}
          anchor={
            <Button
              icon="menu"
              mode="contained"
              onPress={openMenu}
              contentStyle={{ backgroundColor: "#e5e5e5" }} // Цвет кнопки
              labelStyle={{ color: "#000" }} // Цвет текста на кнопке
            >
              Меню
            </Button>
          }
          style={styles.menu} // Применение стилей к списку
        >
          <Menu.Item
            onPress={() => {
              closeMenu();
              navigation.navigate("NotificationHistory");
            }}
            title="История уведомлений"
          />
          {/* <Menu.Item
            onPress={() => {
              closeMenu();
              navigation.navigate("Settings");
            }}
            title="Настройки"
          /> */}
        </Menu>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff", // Фон для отладки
  },
  menuContainer: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 16,
  },
  menu: {
    // Стили для выпадающего списка
    marginTop: 50, // Смещение вниз, если требуется
    backgroundColor: "white",
    borderRadius: 8,
    elevation: 4, // Тень для Android
    shadowColor: "#000", // Тень для iOS
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default HeaderMenu;
