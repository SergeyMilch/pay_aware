# Просто для разработки и тестирования
# Будет APK файл
# Используем официальный образ Node.js для сборки и запуска
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости с флагом --legacy-peer-deps для игнорирования конфликтов peer-зависимостей
RUN npm install --legacy-peer-deps

# Копируем все файлы приложения
COPY . .

# Устанавливаем глобально expo-cli
RUN npm install -g expo-cli

# # Указываем переменную среды для CI/CD
# ENV CI=1

# Указываем команду по умолчанию для запуска Expo сервера
CMD ["npx", "expo", "start", "--lan"]
