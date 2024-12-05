import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SubscriptionListScreen from "../screens/SubscriptionListScreen";
import CreateSubscriptionScreen from "../screens/CreateSubscriptionScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import EditSubscriptionScreen from "../screens/EditSubscriptionScreen";
import SubscriptionDetailScreen from "../screens/SubscriptionDetailScreen";
import SetPinScreen from "../screens/SetPinScreen"; // Добавляем экран для установки ПИН-кода
import EnterPinScreen from "../screens/EnterPinScreen"; // Добавляем экран для ввода ПИН-кода
import { navigationRef } from "./navigationService";
import logger from "../utils/logger";

const Stack = createStackNavigator();

const AppNavigator = ({ initialRoute }) => {
  // Логируем начальный маршрут, переданный в компонент
  logger.log("Начальный маршрут в AppNavigator:", initialRoute);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        logger.log("Навигация готова, текущий экран:", initialRoute);
      }}
      onStateChange={(state) => {
        const currentScreen = state.routes[state.index].name;
        logger.log("Текущий экран после изменения состояния:", currentScreen);
      }}
    >
      <Stack.Navigator
        initialRouteName={
          typeof initialRoute === "string" ? initialRoute : initialRoute?.name
        }
      >
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: "Регистрация" }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Вход" }}
        />
        <Stack.Screen
          name="SetPinScreen"
          component={SetPinScreen}
          options={{ title: "Установка ПИН-кода" }}
        />
        <Stack.Screen
          name="EnterPinScreen"
          component={EnterPinScreen}
          options={{ title: "Введите ПИН-код" }}
        />
        <Stack.Screen
          name="SubscriptionList"
          component={SubscriptionListScreen}
          options={{
            title: "Список подписок",
            headerLeft: null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="CreateSubscription"
          component={CreateSubscriptionScreen}
          options={{ title: "Создать подписку" }}
        />
        <Stack.Screen
          name="EditSubscription"
          component={EditSubscriptionScreen}
          options={{ title: "Редактировать подписку" }}
        />
        <Stack.Screen
          name="SubscriptionDetail"
          component={SubscriptionDetailScreen}
          options={{ title: "Детали подписки" }}
        />
        <Stack.Screen
          name="ForgotPasswordScreen"
          component={ForgotPasswordScreen}
          options={{ title: "Забыли пароль?" }}
        />
        <Stack.Screen
          name="ResetPasswordScreen"
          component={ResetPasswordScreen}
          initialParams={
            typeof initialRoute === "object" && initialRoute?.params
              ? initialRoute.params
              : undefined
          }
          options={{ title: "Новый пароль" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
