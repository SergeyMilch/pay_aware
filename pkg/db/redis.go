package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"github.com/go-redis/redis/v8"
)

var RedisClient *redis.Client
var ctx = context.Background()

// InitRedis инициализирует подключение к Redis
func InitRedis() {

    addr := os.Getenv("REDIS_ADDR")
    if addr == "" {
        log.Fatal("Missing REDIS_ADDR configuration")
    }

    password := os.Getenv("REDIS_PASSWORD")
    db := 0 // Стандартная база, если не указано иное
    if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
        fmt.Sscanf(dbStr, "%d", &db)
    }

    retryAttempts := 3
    sleepDuration := 5 * time.Second

    err := utils.Retry(retryAttempts, sleepDuration, func() error {
        RedisClient = redis.NewClient(&redis.Options{
            Addr:     addr,
            Password: password,
            DB:       db,
        })

        // Устанавливаем контекст с тайм-аутом для команды Ping
        pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()

        _, err := RedisClient.Ping(pingCtx).Result()
        if err != nil {
            logger.Warn("Failed to connect to Redis", "error", err)
            return err
        }
        return nil
    })

    if err != nil {
        logger.Error("Failed to connect to Redis after retries", "error", err)
        log.Fatalf("Failed to connect to Redis: %v", err)
    }

}

// CloseRedis закрывает клиент Redis
func CloseRedis() {
    if RedisClient != nil {
        err := RedisClient.Close()
        if err != nil {
            log.Printf("Error closing Redis client: %v", err)
        } else {
            log.Println("Redis client closed")
        }
    }
}