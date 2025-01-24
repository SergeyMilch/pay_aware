package db

import (
	"fmt"
	"log"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// GormDB -- глобальная переменная, в которой хранится подключение к GORM
var GormDB *gorm.DB

// InitPostgres инициализирует подключение к базе данных PostgreSQL с использованием GORM
func InitPostgres(cfg *config.Config) {
    // Формируем DSN-строку для PostgreSQL
    dsn := fmt.Sprintf(
        "host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
        cfg.DBHost,
        cfg.DBUser,
        cfg.DBPassword,
        cfg.DBName,
        cfg.DBPort,
        cfg.DBSSLMode,
    )

    var err error
    retryAttempts := 3           // Количество попыток переподключения
    sleepDuration := 5 * time.Second // Пауза между попытками

    // Используем функцию Retry из utils для повторных попыток подключения
    err = utils.Retry(retryAttempts, sleepDuration, func() error {
        // Пытаемся открыть соединение через GORM
        GormDB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err != nil {
            logger.Warn("Failed to connect to database with GORM", "error", err)
            return err
        }
        return nil
    })

    if err != nil {
        logger.Error("Failed to connect to database with GORM after retries", "error", err)
        log.Fatalf("Failed to connect to database with GORM: %v", err)
    }

    // Выполняем миграции для наших моделей
    if err = GormDB.AutoMigrate(
        &models.User{},
        &models.Subscription{},
        &models.Notification{},
    ); err != nil {
        logger.Error("Failed to migrate models", "error", err)
        log.Fatalf("Failed to migrate models: %v", err)
    }
    
    logger.Info("Database migrated successfully")

    // Создаём уникальный индекс только для тех записей, у которых deleted_at IS NULL
    createUniqueEmailIndex()
}

// createUniqueEmailIndex создаёт "частичный" уникальный индекс в PostgreSQL, 
// чтобы email проверялся на уникальность только для активных (не удалённых) записей.
func createUniqueEmailIndex() {
    // SQL-запрос на создание уникального индекса с условием
    query := `
        CREATE UNIQUE INDEX IF NOT EXISTS unique_email_active
        ON users (email)
        WHERE deleted_at IS NULL;
    `
    // Выполняем запрос в базе PostgreSQL
    if err := GormDB.Exec(query).Error; err != nil {
        logger.Error("Failed to create partial unique index for email", "error", err)
        log.Fatalf("Failed to create partial unique index for email: %v", err)
    }

    logger.Info("Unique partial index for email (active users) created successfully")
}

// InitTestPostgres инициализирует тестовую базу данных с использованием SQLite (in-memory)
func InitTestPostgres() {
    var err error
    // Открываем базу данных в памяти (SQLite)
    GormDB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil {
        log.Fatalf("Failed to connect to the test database: %v", err)
    }

    log.Println("Test database initialized successfully")
}
