import { registerRootComponent } from "expo"; // Функция для регистрации корневого компонента в Expo
import App from "./App"; // Импорт вашего основного компонента

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Регистрация корневого компонента. Expo обрабатывает остальное.
registerRootComponent(App);
