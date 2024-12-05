package main

import (
	"os"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/kafka"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/handlers"
	"github.com/SergeyMilch/pay_aware/pkg/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	// Инициализируем логирование
	logger.Init(env)
	logger.Info("Logger initialized, excluding sensitive data")

	// Загружаем конфигурацию из .env
	cfg := config.LoadConfig()
	logger.Info("Configuration loaded successfully, excluding sensitive data")

	// Инициализируем подключение к базе данных с GORM
	db.InitPostgres(cfg)
	logger.Info("Postgres initialized with GORM")

	// Инициализируем подключение к базе данных с pgx
	db.InitPgx(cfg)
	logger.Info("Connected to the database successfully with pgx")

	// Инициализируем подключение к Redis
	db.InitRedis()
	logger.Info("Connected to Redis successfully")

	// Загрузка конфигурации Kafka
	kafkaConfig := config.LoadKafkaConfig()
	producer, err := kafka.InitKafka(kafkaConfig)
	if err != nil {
		logger.Error("Failed to initialize Kafka producer", "error", err)
		return // Завершаем работу программы, если Kafka не инициализирован
	}
	defer producer.Close() // Закрываем продюсер при завершении работы
	logger.Info("Kafka producer successfully initialized")

	// Запуск Kafka consumer в горутине
	go kafka.StartKafkaConsumer(kafkaConfig)
	logger.Info("Kafka configuration loaded successfully, excluding sensitive data")

	// Запуск планировщика уведомлений с использованием Kafka продюсера
	go producer.StartNotificationScheduler()
	logger.Info("Notification scheduler started with cron")

	// Создаем экземпляр Gin
	r := gin.Default()

	// Добавляем CORS middleware
	corsConfig := cors.Config{
		AllowOrigins:		[]string{os.Getenv("ADDR_SERVER")}, // Ограничение списка разрешенных доменов
		AllowMethods: 		[]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: 		[]string{"Authorization", "Content-Type"},
		AllowCredentials: 	true,
	}

	// Добавляем CORS middleware глобально
    r.Use(cors.New(corsConfig))

	logger.Info("Gin router initialized")

	// Публичные маршруты
	r.POST("/users", handlers.CreateUser)
	r.POST("/users/login", handlers.LoginUser)
	r.POST("/forgot-password", handlers.ForgotPassword)
    r.POST("/reset-password", handlers.ResetPassword)
	r.GET("/reset-password", handlers.PasswordResetRedirect)
	r.POST("/login-with-pin", handlers.LoginWithPin)

	// Защищенные маршруты
	authorized := r.Group("/")
	authorized.Use(cors.New(corsConfig)) // Применение CORS до JWT авторизации для поддержки OPTIONS запросов
    authorized.Use(middleware.AuthorizeJWT(cfg.JWTSecret))

	{
		authorized.GET("/users", handlers.GetUsers)
		authorized.GET("/users/:id", handlers.GetUserByID)
		authorized.POST("/subscriptions", handlers.CreateSubscription)
		authorized.PUT("/subscriptions/:id", handlers.UpdateSubscription)
		authorized.DELETE("/subscriptions/:id", handlers.DeleteSubscription)
		authorized.GET("/subscriptions", handlers.GetSubscriptions)
		authorized.GET("/subscriptions/:id", handlers.GetSubscriptionByID)
		authorized.PUT("/users/device-token", handlers.UpdateDeviceToken)
		authorized.POST("/set-pin", handlers.SetPin)
		// При больших нагрузках на клиент, можно будет перейти на серверный подход
		// authorized.GET("/subscriptions/total-cost", handlers.GetTotalCost)   <-- расчет общей стоимости реализован на фронтенде
	}

	// Добавляем health-check эндпоинт
	r.GET("/health", middleware.InternalAccessMiddleware(), func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Запускаем сервер
	logger.Info("Starting server on port 8000")
	if err := r.Run("0.0.0.0:8000"); err != nil {
		logger.Error("Failed to start server", "error", err)
	}

}
