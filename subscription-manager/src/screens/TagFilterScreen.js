import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";

/**
 * Экран для выбора тега.
 * Вызывается при нажатии "Фильтр по тегам" в HeaderMenu.
 */
const TagFilterScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // Достаем из route.params список тегов и текущий выбранный
  const { availableTags = [], selectedTag = "" } = route.params || {};

  // Функция выбора тега
  const handleSelectTag = (tag) => {
    // Возвращаемся на SubscriptionList, передавая newSelectedTag
    navigation.navigate("SubscriptionList", { newSelectedTag: tag });
  };

  const allTags = ["", ...availableTags]; // "" означает "Все"

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Выберите тег</Text>

      <FlatList
        data={allTags}
        keyExtractor={(item, index) => item + index}
        renderItem={({ item: tag }) => {
          // Определяем, выбран ли текущий тег
          const isSelected =
            tag === selectedTag || (tag === "" && selectedTag === "");

          // Определяем отображаемый текст
          const displayText = tag === "" ? "Все" : tag;

          return (
            <TouchableOpacity
              style={styles.tagItem}
              onPress={() => handleSelectTag(tag)}
            >
              <View style={styles.tagContent}>
                <Text style={styles.tagText}>{displayText}</Text>
                {isSelected && (
                  <Icon
                    name="check"
                    size={20}
                    color="green"
                    style={styles.checkmark}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 16,
  },
  title: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
  },
  tagItem: {
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  tagContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagText: {
    flex: 1,
    color: "#000",
    fontSize: 16,
  },
  checkmark: {
    color: "green",
    marginRight: 8, // Отступ между текстом и галочкой
  },
});

export default TagFilterScreen;
