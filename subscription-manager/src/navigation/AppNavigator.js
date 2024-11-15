import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SubscriptionListScreen from "../screens/SubscriptionListScreen";
import CreateSubscriptionScreen from "../screens/CreateSubscriptionScreen";
import EditSubscriptionScreen from "../screens/EditSubscriptionScreen";
import SubscriptionDetailScreen from "../screens/SubscriptionDetailScreen";
import { initializeAuthToken, getUserById } from "../api/api";
import { navigationRef } from "./navigationService";

const Stack = createStackNavigator();

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState("Register");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        await initializeAuthToken();
        const token = await AsyncStorage.getItem("authToken");
        const userId = await AsyncStorage.getItem("userId");

        if (token && userId) {
          await verifyUserExists(userId);
        } else {
          console.warn(
            "Токен или userId отсутствуют, перенаправляем на регистрацию"
          );
          setInitialRoute("Register");
        }
      } catch (error) {
        console.error("Ошибка при проверке статуса пользователя:", error);
        setInitialRoute("Register");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    const verifyUserExists = async (userId) => {
      try {
        const user = await getUserById(userId);
        if (user) {
          setInitialRoute("SubscriptionList");
        } else {
          console.warn("Пользователь не найден, перенаправляем на регистрацию");
          setInitialRoute("Register");
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.warn("Пользователь не найден, перенаправляем на регистрацию");
          setInitialRoute("Register");
        } else {
          console.error("Ошибка при получении пользователя:", error);
          setInitialRoute("Login");
        }
      }
    };

    checkUserStatus();
  }, []);

  if (isCheckingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName={initialRoute}>
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
          name="SubscriptionList"
          component={SubscriptionListScreen}
          options={{ title: "Список подписок" }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
