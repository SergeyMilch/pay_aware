import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  Keyboard,
  Switch,
  Modal,
  Pressable,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { getSubscriptionById, updateSubscription } from "../api/api";
import logger from "../utils/logger";
import { isValidName, isValidPrice, isValidTag } from "../utils/validation"; // Импорт функций валидации
import RadioButton from "../components/RadioButton";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const EditSubscriptionScreen = ({ navigation }) => {
  const route = useRoute();
  const { subscriptionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [serviceName, setServiceName] = useState("");
  const [cost, setCost] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isTimePickerVisible, setTimePickerVisibility] = useState(false); // Новое состояние для времени
  const [notificationOffset, setNotificationOffset] = useState(0);

  // Новое состояние для периодичности
  const [recurrenceType, setRecurrenceType] = useState("");
  const [error, setError] = useState("");

  const { availableTags = [] } = route.params || {};

  const [tag, setTag] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const tagInputRef = useRef(null); // Создаем реф для TextInput

  // Состояние для High Priority
  const [highPriority, setHighPriority] = useState(false);

  // Состояние для отображения модального окна подсказки
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  const handleCostChange = (text) => {
    const formattedText = text.replace(",", ".");
    if (isValidPrice(formattedText)) {
      setCost(formattedText);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchSubscription = async () => {
        try {
          const data = await getSubscriptionById(subscriptionId);
          setServiceName(data.service_name);
          setCost(data.cost.toString());
          setNextPaymentDate(new Date(data.next_payment_date)); // Преобразуем строку в Date объект
          setNotificationOffset(data.notification_offset);
          setRecurrenceType(data.recurrence_type || ""); // Считываем периодичность
          setTag(data.tag || ""); // <-- загружаем тег
          setHighPriority(data.high_priority || false); // <-- загружаем high_priority
          logger.log("Подписка загружена успешно:", data);
        } catch (error) {
          logger.error("Ошибка при загрузке подписки:", error);
          Alert.alert("Ошибка", "Не удалось загрузить подписку.");
        } finally {
          setLoading(false);
        }
      };

      fetchSubscription();
    }, [subscriptionId])
  );

  const handleRecurrenceTypeChange = (type) => {
    if (recurrenceType === type) {
      // Если уже выбран этот тип, снимаем выбор
      setRecurrenceType("");
    } else {
      // Иначе выбираем новый тип
      setRecurrenceType(type);
    }
  };

  const handleSave = async () => {
    setError("");

    // Проверка корректности данных
    if (!isValidName(serviceName)) {
      Alert.alert("Ошибка", "Название содержит недопустимые символы.");
      return;
    }
    const formattedCost = Number(parseFloat(cost).toFixed(2));
    if (isNaN(formattedCost) || !isValidPrice(cost)) {
      Alert.alert("Ошибка", "Введите корректную стоимость подписки.");
      return;
    }

    // Дата и время не должны быть в прошлом
    const now = new Date();
    if (nextPaymentDate < now) {
      Alert.alert(
        "Ошибка",
        "Дата и время следующего платежа не могут быть в прошлом."
      );
      return;
    }

    // Проверяем тег
    if (!isValidTag(tag)) {
      Alert.alert(
        "Некорректный тег",
        "Тег должен быть одним словом (без пробелов) и не длиннее 20 символов."
      );
      setLoading(false);
      return;
    }

    try {
      const updatedData = {
        service_name: serviceName,
        cost: formattedCost,
        next_payment_date: nextPaymentDate.toISOString(),
        notification_offset: notificationOffset,
        recurrence_type: recurrenceType, // <-- передаем поле периодичности
        tag: tag, // <-- передаём тег
        high_priority: highPriority, // <-- передаем high_priority
      };

      await updateSubscription(subscriptionId, updatedData);
      Alert.alert("Успех", "Подписка успешно обновлена.");
      navigation.navigate("SubscriptionList");
    } catch (error) {
      logger.error("Ошибка при обновлении подписки:", error);
      Alert.alert("Ошибка", "Не удалось обновить подписку. Попробуйте снова.");
    }
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleDateConfirm = (date) => {
    setNextPaymentDate(date);
    hideDatePicker();
  };

  // Новые функции для выбора времени
  const showTimePicker = () => {
    setTimePickerVisibility(true);
  };

  const hideTimePickerFunc = () => {
    setTimePickerVisibility(false);
  };

  const handleTimeConfirm = (time) => {
    // Округляем минуты до ближайших 15
    const adjustedTime = new Date(nextPaymentDate);
    adjustedTime.setHours(time.getHours());
    const minutes = time.getMinutes();
    const adjustedMinutes = Math.round(minutes / 15) * 15;

    // Если округление приводит к 60 минутам, увеличиваем час
    if (adjustedMinutes === 60) {
      adjustedTime.setHours(adjustedTime.getHours() + 1);
      adjustedTime.setMinutes(0);
    } else {
      adjustedTime.setMinutes(adjustedMinutes);
    }

    setNextPaymentDate(adjustedTime);
    hideTimePickerFunc();
  };

  // Функция для обработки выбора напоминания
  const handleNotificationOption = (offset) => {
    if (notificationOffset === offset) {
      // Если уже выбрано, снимаем выбор и устанавливаем 0
      setNotificationOffset(0);
    } else {
      // Устанавливаем новое значение
      setNotificationOffset(offset);
    }
  };

  const handleTagChange = (input) => {
    let trimmed = input.trim();
    if (trimmed === "") {
      setTag("");
      setSuggestions([]); // ничего не подсказываем
      return;
    }

    if (/\s/.test(input)) {
      Alert.alert(
        "Неверный ввод",
        'Тег должен быть одним словом (без пробелов). Например, "Можно_отписаться"'
      );
    }

    let noSpaces = trimmed.replace(/\s+/g, "");

    // Допустим, хотим 20 unicode-символов (JS .length обычно == кол-во Unicode code units)
    if (noSpaces.length > 20) {
      Alert.alert("Тег не может быть длиннее 20 символов!");
      noSpaces = noSpaces.slice(0, 20);
    }
    setTag(noSpaces);

    const filtered = availableTags.filter((t) =>
      t.toLowerCase().startsWith(noSpaces.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 5));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled" // Добавлено
    >
      <View style={styles.container}>
        <Text style={styles.label}>Название сервиса</Text>
        <TextInput
          style={styles.input}
          value={serviceName}
          onChangeText={setServiceName}
          placeholder="Название сервиса"
        />
        <Text style={styles.label}>Стоимость</Text>
        <TextInput
          style={styles.input}
          value={cost}
          onChangeText={handleCostChange}
          placeholder="Стоимость"
          keyboardType="numeric"
        />

        {/* Блок выбора даты следующего платежа */}
        <Text style={styles.label}>Дата следующего платежа</Text>
        {Platform.OS === "web" ? (
          <TextInput
            type="date"
            style={styles.input}
            value={nextPaymentDate.toISOString().split("T")[0]}
            onChangeText={(text) => {
              const date = new Date(text);
              if (!isNaN(date)) {
                setNextPaymentDate(date);
              }
            }}
            placeholder="Дата следующего платежа (например, 2024-11-15)"
          />
        ) : (
          <TouchableOpacity onPress={showDatePicker}>
            <TextInput
              style={styles.input}
              value={
                nextPaymentDate ? nextPaymentDate.toLocaleDateString() : ""
              }
              placeholder="Дата следующего платежа"
              editable={false}
            />
          </TouchableOpacity>
        )}
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleDateConfirm}
          onCancel={hideDatePicker}
        />

        {/* Новый блок для выбора времени */}
        <Text style={styles.label}>Время напоминания</Text>
        <TouchableOpacity onPress={showTimePicker}>
          <TextInput
            style={styles.input}
            value={
              nextPaymentDate
                ? nextPaymentDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""
            }
            placeholder="Выберите время напоминания"
            editable={false}
          />
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isTimePickerVisible}
          mode="time"
          onConfirm={handleTimeConfirm}
          onCancel={hideTimePickerFunc}
          is24Hour={true}
        />

        <Text style={[styles.label, { textAlign: "center", fontSize: 18 }]}>
          Дополнительно
        </Text>

        <Text style={styles.label}>Напомнить за:</Text>
        <View style={styles.notificationContainer}>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 1440 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(1440)}
          >
            <Text style={styles.buttonText}>1 день</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 60 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(60)}
          >
            <Text style={styles.buttonText}>1 час</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 15 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(15)}
          >
            <Text style={styles.buttonText}>15 минут</Text>
          </TouchableOpacity>
        </View>

        {/* Блок выбора периодичности с радиокнопками */}
        <Text style={styles.label}>Периодичность напоминания:</Text>
        <View style={styles.radioGroup}>
          <RadioButton
            label="Ежемесячно"
            selected={recurrenceType === "monthly"}
            onPress={() => handleRecurrenceTypeChange("monthly")}
          />
          <RadioButton
            label="Ежегодно"
            selected={recurrenceType === "yearly"}
            onPress={() => handleRecurrenceTypeChange("yearly")}
          />
        </View>

        {/* Тег */}
        <Text style={styles.label}>Тег (возможность поиска):</Text>
        {/* Отображаем список подсказок */}
        {suggestions.length > 0 && (
          <View
            style={{
              backgroundColor: "#f0f0f0",
              borderWidth: 1, // Установите тонкую рамку
              borderColor: "#ccc", // Цвет рамки
              borderRadius: 4, // Опционально: скругление углов
              marginTop: 5, // Опционально: отступ сверху
            }}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  // При выборе ставим tag = item, скрываем подсказки
                  setTag(item);
                  setSuggestions([]);
                  Keyboard.dismiss(); // Скрываем клавиатуру
                }}
                style={{
                  padding: 8,
                  borderBottomWidth: 0.5, // Опционально: разделитель между элементами
                  borderBottomColor: "#ddd", // Цвет разделителя
                }}
              >
                <Text style={{ color: "gray" }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TextInput
          ref={tagInputRef} // Присваиваем реф
          style={styles.input}
          value={tag}
          onChangeText={handleTagChange}
          placeholder="Одно слово до 20 символов (или оставьте пустым)"
        />
        <Text style={{ fontSize: 12, color: "#666" }}>
          {tag.length} / 20 символов
        </Text>

        {/* Добавляем переключатель для High Priority с иконкой подсказки */}
        <View style={styles.checkboxContainer}>
          <Text style={styles.checkboxLabel}>Более заметное уведомление</Text>
          <View style={styles.switchContainer}>
            <Switch
              value={highPriority}
              onValueChange={(value) => setHighPriority(value)}
            />
            <TouchableOpacity
              onPress={() => setTooltipVisible(true)}
              style={styles.infoIcon}
            >
              <MaterialIcons name="info-outline" size={24} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Модальное окно подсказки */}
        <Modal
          transparent={true}
          animationType="fade"
          visible={isTooltipVisible}
          onRequestClose={() => setTooltipVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setTooltipVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
                Включив эту опцию, вы будете получать более заметные уведомления
                о предстоящих платежах. Такие уведомления будут содержать иконки
                или специальные символы для привлечения вашего внимания.
              </Text>
              <TouchableOpacity
                onPress={() => setTooltipVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Сохранить</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  scrollContent: {
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  notificationContainer: {
    marginVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notificationButton: {
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  selectedButton: {
    backgroundColor: "#dcdcdc",
    borderColor: "#000", // Дополнительно: изменяем цвет границы при выборе
  },
  buttonText: {
    color: "#000",
  },
  radioGroup: {
    flexDirection: "column",
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  checkboxLabel: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIcon: {
    marginLeft: 4,
    marginRight: 6,
  },
  // Стили для модального окна
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)", // Полупрозрачный фон
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#d5d2ec",
    borderRadius: 4,
  },
  closeButtonText: {
    color: "#000",
    fontSize: 16,
  },
  saveButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 4,
    backgroundColor: "#d5d2ec",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#000",
    fontSize: 16,
  },
  errorText: {
    color: "red",
    marginBottom: 16,
    textAlign: "center",
  },
});

export default EditSubscriptionScreen;
