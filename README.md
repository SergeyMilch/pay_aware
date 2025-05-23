# pay_aware

**pay_aware** — это сервис для управления подписками и напоминаниями о платежах, который помогает пользователям отслеживать свои подписки и получать своевременные уведомления о предстоящих платежах.

## Особенности

- • **Управление подписками**: добавление, редактирование и удаление подписок.
- • **Напоминания о платежах**: автоматическая отправка push-уведомлений о предстоящих платежах.
- • **Аналитика расходов**: отслеживание и анализ расходов по подпискам.

## Установка

### Требования

- **Go** версии 1.19 или выше
- **Node.js** версии 20 или выше
- **Yarn** для управления зависимостями фронтенда
- **Docker** и **Docker Compose** для контейнеризации и запуска зависимых сервисов

### Шаги установки

1. **Клонирование репозитория**:

   ```sh
   git clone https://github.com/SergeyMilch/pay_aware.git
   cd pay_aware
   ```

2. **Установка зависимостей фронтенда**:

   Перейдите в директорию фронтенда и установите зависимости:

   ```sh
   cd frontend
   yarn install
   ```

3. **Настройка переменных окружения**:

   Создайте файл `.env` в корневой директории проекта и добавьте следующие переменные:

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db
   JWT_SECRET=your_jwt_secret_key
   REDIS_ADDR=localhost:6379
   REDIS_PASSWORD=your_redis_password
   KAFKA_BROKER=localhost:9092
   KAFKA_TOPIC=your_topic
   KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092
   KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092

   DB_SSL_MODE=require  # set to "disable" for no SSL
   REDIS_TLS_ENABLED=true  # set to "false" if SSL is not required
   KAFKA_USE_SSL=true  # set to "false" if SSL is not required
   ```

   Замените `your_db_user`, `your_db`, `your_db_password`, `your_jwt_secret_key` и `your_redis_password` на ваши реальные данные.

4. **Запуск сервисов с помощью Docker Compose**:

   В корневой директории проекта выполните команду:

   ```sh
   docker-compose up
   ```

   Это запустит все необходимые сервисы, включая базу данных PostgreSQL, Redis, Zookeeper, Kafka и другие, используя конфигурацию из файла `docker-compose.yml`.

5. **Запуск бэкенда**:

   В отдельном терминале выполните:

   ```sh
   go run cmd/server/main.go
   ```

   Это запустит сервер бэкенда на Go.

6. **Запуск фронтенда**:

   В директории `frontend` выполните:

   ```sh
   npx expo start
   ```

   Это запустит сервер разработки Expo для фронтенда. По умолчанию приложение будет доступно через Expo на вашем устройстве или эмуляторе.

## Использование

После успешного запуска вы можете получить доступ к приложению через браузер по адресу [http://localhost:8000](http://localhost:8000), а также через Expo на вашем мобильном устройстве.

## Тестирование

Для запуска тестов выполните:

```sh
go test ./...
```

Это выполнит все тесты в проекте.

## Архитектура проекта

- **PostgreSQL** — для хранения данных о пользователях и подписках.
- **Redis** — используется для кэширования данных.
- **Kafka и Zookeeper** — для отправки push-уведомлений о подписках.
- **Logstash, Elasticsearch, Kibana** — для сбора и анализа логов.
- **Nginx** — в качестве реверс-прокси для обработки HTTPS-запросов.
- **Expo (React Native)** — фронтенд, предоставляющий интерфейс для управления подписками пользователями.

## Вклад в проект

Мы приветствуем вклад сообщества! Чтобы внести свой вклад:

1. Форкните репозиторий.
2. Создайте ветку для ваших изменений (`git checkout -b feature/YourFeature`).
3. Внесите изменения и сделайте коммит (`git commit -m 'Добавление новой функции'`).
4. Отправьте изменения в ваш форк (`git push origin feature/YourFeature`).
5. Создайте Pull Request в оригинальный репозиторий.

## Лицензия

Этот проект лицензирован на условиях лицензии MIT. Подробности можно найти в файле LICENSE.
