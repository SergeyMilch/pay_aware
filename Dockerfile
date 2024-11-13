# Используем официальный образ Go в качестве базового образа
FROM golang:1.22 as builder

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем go.mod и go.sum для установки зависимостей
COPY go.mod go.sum ./

# Загружаем модули и сохраняем слой
RUN go mod download

# Копируем весь код в рабочую директорию
COPY . .

# Сборка приложения
RUN go build -o pay_aware ./cmd/server/main.go

# Финальный контейнер для запуска
FROM debian:stable-slim

# Устанавливаем нужные зависимости
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Устанавливаем рабочую директорию
WORKDIR /root/

# Копируем бинарный файл из builder контейнера
COPY --from=builder /app/pay_aware .

# Копируем .env файл для переменных окружения
COPY .env .

# Указываем команду по умолчанию для запуска контейнера
CMD ["./pay_aware"]
