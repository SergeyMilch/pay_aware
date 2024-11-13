package handlers

import (
	"context"
	"net/http"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/gin-gonic/gin"
)

// ClearCache очищает кэшированные данные в Redis
func ClearCache(c *gin.Context) {
    ctx := context.Background()

    // Удаление списка пользователей
    err := db.RedisClient.Del(ctx, "users_list").Err()
    if err != nil {
        logger.Error("Failed to delete users list cache", "error", err)
    } else {
        logger.Info("Users list cache deleted successfully")
    }

    // Удаление кэша подписок
    var deletedKeysCount int
    cursor := uint64(0)
    for {
        keys, nextCursor, err := db.RedisClient.Scan(ctx, cursor, "subscriptions:user:*", 10).Result()
        if err != nil {
            logger.Error("Failed to scan subscription keys from cache", "error", err)
            break
        }
        if len(keys) > 0 {
            err := db.RedisClient.Del(ctx, keys...).Err()
            if err != nil {
                logger.Error("Failed to delete subscription keys from cache", "error", err)
            } else {
                deletedKeysCount += len(keys)
            }
        }
        cursor = nextCursor
        if cursor == 0 {
            break
        }
    }
    logger.Info("Subscriptions cache deleted successfully", "deletedKeysCount", deletedKeysCount)

    // Удаление кэша общей стоимости
    deletedKeysCount = 0
    cursor = 0
    for {
        keys, nextCursor, err := db.RedisClient.Scan(ctx, cursor, "total_cost:user:*", 10).Result()
        if err != nil {
            logger.Error("Failed to scan total cost keys from cache", "error", err)
            break
        }
        if len(keys) > 0 {
            err := db.RedisClient.Del(ctx, keys...).Err()
            if err != nil {
                logger.Error("Failed to delete total cost keys from cache", "error", err)
            } else {
                deletedKeysCount += len(keys)
            }
        }
        cursor = nextCursor
        if cursor == 0 {
            break
        }
    }
    logger.Info("Total cost cache deleted successfully", "deletedKeysCount", deletedKeysCount)

    // Удаление кэша пользователей
    deletedKeysCount = 0
    cursor = 0
    for {
        keys, nextCursor, err := db.RedisClient.Scan(ctx, cursor, "user:*", 10).Result()
        if err != nil {
            logger.Error("Failed to scan user keys from cache", "error", err)
            break
        }
        if len(keys) > 0 {
            err := db.RedisClient.Del(ctx, keys...).Err()
            if err != nil {
                logger.Error("Failed to delete user keys from cache", "error", err)
            } else {
                deletedKeysCount += len(keys)
            }
        }
        cursor = nextCursor
        if cursor == 0 {
            break
        }
    }
    logger.Info("User cache deleted successfully", "deletedKeysCount", deletedKeysCount)

    c.JSON(http.StatusOK, gin.H{"message": "Cache cleared successfully"})
}
