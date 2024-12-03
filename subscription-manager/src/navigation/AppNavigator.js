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
import { navigationRef } from "./navigationService";

const Stack = createStackNavigator();

const AppNavigator = ({ initialRoute }) => {
  return (
    <NavigationContainer ref={navigationRef}>
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
