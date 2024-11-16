package config

import (
	"os"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/joho/godotenv"
)

type Config struct {
    DBHost     string
    DBPort     string
    DBUser     string
    DBPassword string
    DBName     string
    JWTSecret  string
}

func LoadConfig() *Config {
    err := godotenv.Load("/app/.env")
    if err != nil {
        logger.Warn("No .env file found", "error", err)
    } else {
        logger.Info(".env file loaded successfully")
    }

    cfg := &Config{
        DBHost:     os.Getenv("DB_HOST"),
        DBPort:     os.Getenv("DB_PORT"),
        DBUser:     os.Getenv("DB_USER"),
        DBPassword: os.Getenv("DB_PASSWORD"),
        DBName:     os.Getenv("DB_NAME"),
        JWTSecret:  os.Getenv("JWT_SECRET"),
    }

    // Проверяем наличие всех критических переменных среды
    if cfg.DBHost == "" || cfg.DBUser == "" || cfg.DBPassword == "" || cfg.JWTSecret == "" {
        logger.Error("Critical environment variables are missing. Shutting down.")
        os.Exit(1)
    }

    return cfg
}
