import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SubscriptionListScreen from "../screens/SubscriptionListScreen";
import CreateSubscriptionScreen from "../screens/CreateSubscriptionScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import EditSubscriptionScreen from "../screens/EditSubscriptionScreen";
import SubscriptionDetailScreen from "../screens/SubscriptionDetailScreen";
import { initializeAuthToken, getUserById, isTokenExpired } from "../api/api";
import { navigationRef } from "./navigationService";
import logger from "../utils/logger";

const Stack = createStackNavigator();

const AppNavigator = () => {
  const [initialRoute, setInitialRoute] = useState("Register");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const data = Linking.parse(initialUrl);
        if (data.path === "reset-password" && data.queryParams?.token) {
          logger.log(
            "Приложение открыто через универсальную ссылку, перенаправляем на ResetPasswordScreen"
          );
          navigationRef.current?.navigate("ResetPasswordScreen", {
            token: data.queryParams.token,
          });
        }
      }
    };

    const checkUserStatus = async () => {
      try {
        await initializeAuthToken();
        const token = await SecureStore.getItemAsync("authToken");
        const userId = await SecureStore.getItemAsync("userId");

        if (token && userId) {
          if (isTokenExpired(token)) {
            logger.warn("JWT токен истек, перенаправляем на экран логина");
            setInitialRoute("Login");
          } else {
            await verifyUserExists(userId);
          }
        } else {
          logger.warn(
            "Токен или userId отсутствуют, перенаправляем на регистрацию"
          );
          setInitialRoute("Register");
        }
      } catch (error) {
        logger.error("Ошибка при проверке статуса пользователя:", error);
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
          logger.warn("Пользователь не найден, перенаправляем на регистрацию");
          setInitialRoute("Register");
        }
      } catch (error) {
        if (error.response?.status === 404) {
          logger.warn("Пользователь не найден, перенаправляем на регистрацию");
          setInitialRoute("Register");
        } else {
          logger.error("Ошибка при получении пользователя:", error);
          setInitialRoute("Login");
        }
      }
    };

    const initializeApp = async () => {
      await checkInitialUrl(); // Проверяем начальный URL
      await checkUserStatus(); // Проверяем статус пользователя
    };

    initializeApp();
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
          options={{ title: "Новый пароль" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
