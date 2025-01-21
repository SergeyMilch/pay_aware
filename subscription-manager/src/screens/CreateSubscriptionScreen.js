import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Keyboard,
  Switch,
  Modal,
  Pressable,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { createSubscription } from "../api/api";
import { isValidName, isValidPrice, isValidTag } from "../utils/validation";
import logger from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { navigationRef } from "../navigation/navigationService";
import {
  registerForPushNotificationsAsync,
  sendDeviceTokenToServer,
} from "../utils/notifications";
import RadioButton from "../components/RadioButton";
import { useRoute } from "@react-navigation/native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const CreateSubscriptionScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isTimePickerVisible, setTimePickerVisibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationOffset, setNotificationOffset] = useState(null);
  const [deviceToken, setDeviceToken] = useState("");

  // Поле для выбора типа периодичности
  const [recurrenceType, setRecurrenceType] = useState("");
  // Поле для ввода тега
  const [tag, setTag] = useState(""); // <-- по умолчанию пусто

  const route = useRoute();
  // Достаем массив тегов (по умолчанию пустой если нет)
  const { availableTags = [] } = route.params || {};

  const [suggestions, setSuggestions] = useState([]); // список подсказок

  const tagInputRef = useRef(null); // Создаем реф для TextInput

  // Состояние для High Priority
  const [highPriority, setHighPriority] = useState(false);

  // Состояние для отображения модального окна подсказки
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  // Проверка токена при загрузке экрана
  useEffect(() => {
    const checkToken = async () => {
      logger.log("Начало проверки наличия токена авторизации...");
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.log("Токен авторизации успешно найден");
      }
    };
    checkToken();
  }, []);

  const handlePriceChange = (text) => {
    logger.log("Пользователь изменяет стоимость подписки");
    const formattedText = text.replace(",", ".");
    if (isValidPrice(formattedText)) {
      setPrice(formattedText);
      logger.log("Стоимость подписки успешно обновлена:", formattedText);
    } else {
      logger.warn("Некорректная стоимость подписки:", formattedText);
    }
  };

  // Проверка разрешений на уведомления при выборе напоминания
  const handleNotificationOption = async (offset) => {
    if (notificationOffset === offset) {
      // Если пользователь нажал на уже выбранную кнопку, снимаем выбор
      setNotificationOffset(null);
      return;
    }

    logger.log("Проверяем статус разрешений для push-уведомлений...");
    const deviceToken = await registerForPushNotificationsAsync();

    if (deviceToken) {
      logger.log("Получен токен устройства:", deviceToken);
      setDeviceToken(deviceToken);
      try {
        await sendDeviceTokenToServer(deviceToken);
        logger.log("Токен устройства успешно отправлен на сервер.");
      } catch (error) {
        logger.error("Ошибка при отправке токена устройства на сервер:", error);
      }
      setNotificationOffset(offset);
      logger.log("Напоминание установлено за:", offset, "минут");
    } else {
      logger.warn(
        "Не удалось получить разрешение на push-уведомления. Пожалуйста, включите уведомления в настройках."
      );
      Alert.alert(
        "Необходимо включить уведомления",
        "Для получения напоминаний о подписке необходимо включить уведомления. Пожалуйста, включите уведомления в настройках устройства.",
        [
          {
            text: "Ок",
          },
        ]
      );
    }
  };

  const handleRecurrenceTypeChange = (type) => {
    if (recurrenceType === type) {
      // Если уже выбран этот тип, снимаем выбор
      setRecurrenceType("");
    } else {
      // Иначе выбираем новый тип
      setRecurrenceType(type);
    }
  };

  const handleSubmit = async () => {
    logger.log("Начало создания подписки...");
    setLoading(true);
    setError("");

    // Проверка входных данных перед отправкой
    if (!isValidName(name)) {
      logger.warn("Некорректное название подписки:", name);
      setError("Название подписки содержит недопустимые символы.");
      setLoading(false);
      return;
    }

    const parsedPrice = parseFloat(parseFloat(price).toFixed(2));
    if (isNaN(parsedPrice)) {
      logger.warn("Некорректная стоимость подписки:", price);
      setError("Введите корректную стоимость подписки.");
      setLoading(false);
      return;
    }

    // Дата и время не должны быть в прошлом
    const now = new Date();
    if (nextPaymentDate < now) {
      logger.warn(
        "Дата и время следующего платежа в прошлом:",
        nextPaymentDate
      );
      setError("Дата и время следующего платежа не могут быть в прошлом.");
      setLoading(false);
      return;
    }

    if (notificationOffset !== null && !deviceToken) {
      logger.warn(
        "Пользователь пытается создать подписку с напоминанием без включенных уведомлений"
      );
      setError(
        "Для установки напоминания необходимо включить уведомления. Пожалуйста, проверьте настройки устройства."
      );
      setLoading(false);
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
      // Проверка токена перед отправкой
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        logger.warn("Токен отсутствует, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
        return;
      }

      // Устанавливаем notificationOffset на 0, если пользователь не выбрал напоминание
      const notificationOffsetToSend =
        notificationOffset !== null ? notificationOffset : 0;

      // Создаем подписку
      const response = await createSubscription({
        service_name: name,
        cost: parsedPrice,
        next_payment_date: nextPaymentDate.toISOString(),
        notification_offset: notificationOffsetToSend,
        recurrence_type: recurrenceType, // <-- передаем тип периодичности
        tag: tag, // <-- передаем тег
        high_priority: highPriority, // <-- передаем тип заметности
      });

      if (response && response.ID) {
        logger.log("Подписка успешно создана:", response);
        setTimeout(() => {
          navigation.goBack();
        }, 500);
      } else {
        logger.warn("Ответ от сервера не содержит ID подписки:", response);
        setError("Не удалось создать подписку. Попробуйте еще раз.");
      }
    } catch (error) {
      if (error.message === "SessionExpired") {
        logger.warn("Сессия истекла, перенаправляем на экран логина");
        Alert.alert("Сессия истекла", "Пожалуйста, войдите снова.");
        navigationRef.navigate("Login");
      } else {
        logger.error("Ошибка при создании подписки:", error);
        setError("Не удалось создать подписку. Попробуйте еще раз.");
      }
    } finally {
      setLoading(false);
      logger.log("Процесс создания подписки завершен");
    }
  };

  const showDatePicker = () => {
    logger.log("Показать выбор даты");
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    logger.log("Скрыть выбор даты");
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    logger.log("Дата следующего платежа выбрана:", date);
    setNextPaymentDate(date); // Сохраняем объект Date напрямую
    hideDatePicker();
  };

  // Добавляем функции для управления тайм-пикером
  const showTimePicker = () => {
    logger.log("Показать выбор времени");
    setTimePickerVisibility(true);
  };

  const hideTimePicker = () => {
    logger.log("Скрыть выбор времени");
    setTimePickerVisibility(false);
  };

  const handleTimeConfirm = (time) => {
    logger.log("Время следующего платежа выбрано:", time);

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
    hideTimePicker();
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
      Alert.alert("Тег не может быть длиннее 20 символов");
      noSpaces = noSpaces.slice(0, 20);
    }
    setTag(noSpaces);

    // Фильтруем теги: startsWith (регистронезависимо)
    const filtered = availableTags.filter((t) =>
      t.toLowerCase().startsWith(noSpaces.toLowerCase())
    );
    // Показываем максимум 5
    setSuggestions(filtered.slice(0, 5));
  };

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
          value={name}
          onChangeText={(value) => {
            logger.log("Пользователь изменяет название подписки");
            setName(value);
          }}
          placeholder="Введите название подписки"
        />
        <Text style={styles.label}>Стоимость</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={handlePriceChange}
          placeholder="Введите стоимость подписки"
          keyboardType="numeric"
        />
        <Text style={styles.label}>Дата следующего платежа</Text>
        <TouchableOpacity onPress={showDatePicker}>
          <TextInput
            style={styles.input}
            value={nextPaymentDate ? nextPaymentDate.toLocaleDateString() : ""}
            placeholder="Выберите дату следующего платежа"
            editable={false}
          />
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
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
          onCancel={hideTimePicker}
          is24Hour={true}
        />
        <Text style={[styles.label, { textAlign: "center", fontSize: 18 }]}>
          Дополнительно
        </Text>
        <Text style={styles.label}>Напомнить:</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 1440 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(1440)}
          >
            <Text>За день</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 60 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(60)}
          >
            <Text>За час</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              notificationOffset === 15 && styles.selectedButton,
            ]}
            onPress={() => handleNotificationOption(15)}
          >
            <Text>За 15 минут</Text>
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

        {/* Поле для тега */}
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
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
            <Text style={styles.saveButtonText}>Создать</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

// Описание стилей
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  scrollContent: {
    padding: 16, // отступы внутри скролла
    backgroundColor: "#f0f0f0",
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
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  notificationButton: {
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  selectedButton: {
    backgroundColor: "#dcdcdc",
    borderColor: "#000", // Дополнительно: изменяем цвет границы при выборе
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
  errorText: {
    color: "red",
    marginBottom: 16,
    textAlign: "center",
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
});

export default CreateSubscriptionScreen;
