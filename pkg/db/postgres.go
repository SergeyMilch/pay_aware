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

var GormDB *gorm.DB

// InitPostgres инициализирует подключение к базе данных PostgreSQL с использованием GORM
func InitPostgres(cfg *config.Config) {
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
    retryAttempts := 3
    sleepDuration := 5 * time.Second

    err = utils.Retry(retryAttempts, sleepDuration, func() error {
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

    // Миграция моделей
    if err = GormDB.AutoMigrate(&models.User{}, &models.Subscription{}, &models.Notification{}); err != nil {
        logger.Error("Failed to migrate models", "error", err)
        log.Fatalf("Failed to migrate models: %v", err)
    }
    
    logger.Info("Database migrated successfully")
}

// InitTestPostgres инициализирует тестовую базу данных с использованием SQLite (in-memory)
func InitTestPostgres() {
    var err error
    GormDB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil {
        log.Fatalf("Failed to connect to the test database: %v", err)
    }

    log.Println("Test database initialized successfully")
}
