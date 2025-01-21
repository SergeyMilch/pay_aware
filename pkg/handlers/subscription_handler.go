package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateSubscription создает новую подписку
func CreateSubscription(c *gin.Context) {
    // Считываем userID из контекста (он туда кладётся после JWT-проверки)
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    // Создаем переменную subscription (структура models.Subscription),
    // и пробуем заполнить её данными из JSON, который пришёл в запросе.
    var subscription models.Subscription
    if err := c.ShouldBindJSON(&subscription); err != nil {
        logger.Warn("Failed to bind JSON for subscription", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
        return
    }

    // Устанавливаем userID в модель подписки
    subscription.UserID = userIDInt

	// Разрешаем пустую строку. Если не пустая — проверяем, не длиннее 20 символов
	// и чтобы не содержала пробелов.
	if utf8.RuneCountInString(subscription.Tag) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag must be at most 20 characters"})
		return
	}
	if utils.ContainsSpace(subscription.Tag) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag must be a single word (no spaces allowed)."})
		return
	}

    // Здесь можно проверить обязательные поля, например:
    // - ServiceName не должен быть пустым
    // - NextPaymentDate не должен быть нулевым временем
    // - Cost (стоимость) должна быть > 0
    // Если что-то не так — возвращаем ошибку клиенту.
    // Проверка обязательных полей
    if subscription.ServiceName == "" || subscription.NextPaymentDate.IsZero() {
        logger.Warn("Missing required fields in subscription", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Service name and next payment date are required"})
        return
    }

    // Проверка, что дата следующего платежа не является прошедшей
    if subscription.NextPaymentDate.Before(time.Now()) {
        logger.Warn("Next payment date cannot be in the past", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Next payment date cannot be in the past"})
        return
    }

    // Проверка, что стоимость больше нуля
    if subscription.Cost <= 0 {
        logger.Warn("Cost must be greater than zero", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Cost must be greater than zero"})
        return
    }

    // Приводим дату следующего платежа к UTC
    subscription.NextPaymentDate = subscription.NextPaymentDate.UTC()

    // Вычисляем дату и время уведомления только если NotificationOffset > 0
    if subscription.NotificationOffset > 0 {
        // Расчитываем NotificationDate (точное время, когда надо отправить пуш)
        // Оно = NextPaymentDate - NotificationOffset
        subscription.NotificationDate = subscription.NextPaymentDate.Add(-time.Duration(subscription.NotificationOffset) * time.Minute)
    } else {
        // Если NotificationOffset == 0, устанавливаем NotificationDate равным NextPaymentDate
        subscription.NotificationDate = subscription.NextPaymentDate
    }

    // Создание подписки в базе данных
    if err := db.GormDB.Create(&subscription).Error; err != nil {
        logger.Error("Failed to create subscription", "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
        return
    }

    // Удаляем кэш (Redis) по подпискам пользователя, чтобы фронт при следующем запросе мог увидеть новую подписку
    redisKey := fmt.Sprintf("subscriptions:user:%d", subscription.UserID)
    db.RedisClient.Del(context.Background(), redisKey)
    logger.Debug("Deleted subscriptions cache after creating a subscription", "userID", subscription.UserID)

    logger.Debug("Subscription created successfully", "subscriptionID", subscription.ID, "userID", subscription.UserID)

    // Возвращаем всю структуру подписки
    c.JSON(http.StatusOK, subscription)
}

// UpdateSubscription обновляет информацию о подписке
func UpdateSubscription(c *gin.Context) {
    // Достаем userID из контекста
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    // ID подписки, которую хотим обновить
    id := c.Param("id")

    // Сначала ищем в базе текущую подписку, чтобы убедиться, что она действительно 
    // существует и принадлежит этому userID.
    var existingSubscription models.Subscription
    // Поиск подписки по ID и проверка принадлежности пользователю
    if err := db.GormDB.Where("id = ? AND user_id = ?", id, userIDInt).First(&existingSubscription).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
            return
        }
        logger.Warn("Error retrieving subscription", "id", id, "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve subscription"})
        return
    }

    // Создаем структуру updatedData, в неё поместим новые данные, пришедшие в теле запроса
    var updatedData models.Subscription
    if err := c.ShouldBindJSON(&updatedData); err != nil {
        logger.Warn("Failed to bind JSON for subscription update", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
        return
    }

    // Проверка обязательных полей
    if updatedData.ServiceName == "" || updatedData.NextPaymentDate.IsZero() {
        logger.Warn("Missing required fields in subscription update", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Service name and next payment date are required"})
        return
    }

    // Приведение времени к UTC, чтобы избежать ошибок с часовыми поясами
    nextPaymentDateUTC := updatedData.NextPaymentDate.UTC()

    if utf8.RuneCountInString(updatedData.Tag) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag must be at most 20 characters"})
		return
	}
	if utils.ContainsSpace(updatedData.Tag) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag must be a single word (no spaces allowed)."})
		return
	}

    // Обновляем поля existingSubscription (объект, который взяли из БД) новыми значениями
    // Поле existingSubscription.ID при этом останется прежним, то есть мы меняем только данные
    // (ServiceName, Cost, NextPaymentDate, NotificationOffset и RecurrenceType).
    // Обновление данных подписки
    existingSubscription.ServiceName = updatedData.ServiceName
    existingSubscription.Cost = updatedData.Cost
    existingSubscription.NextPaymentDate = nextPaymentDateUTC
    existingSubscription.NotificationOffset = updatedData.NotificationOffset
    // Обновляем поле RecurrenceType
    // (если пользователь на фронте выбрал "monthly"/"yearly"/"" и отправил это, мы сохраним)
    existingSubscription.RecurrenceType = updatedData.RecurrenceType
    existingSubscription.Tag = updatedData.Tag // <-- обновляем тег
    existingSubscription.HighPriority = updatedData.HighPriority // Обновляем поле заметности

    // Пересчитываем дату и время уведомления
    if existingSubscription.NotificationOffset > 0 {
        // NotificationDate = NextPaymentDate - NotificationOffset
        existingSubscription.NotificationDate = existingSubscription.NextPaymentDate.Add(-time.Duration(existingSubscription.NotificationOffset) * time.Minute)
    } else {
        // NotificationDate = NextPaymentDate
        existingSubscription.NotificationDate = existingSubscription.NextPaymentDate
    }

    if err := db.GormDB.Save(&existingSubscription).Error; err != nil {
        logger.Error("Failed to update subscription", "id", existingSubscription.ID, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription"})
        return
    }

    // После обновления удаляем кэш по подпискам этого пользователя,
    // чтобы при новом запросе с фронта база уже отдавала свежие данные.
    // Удаляем кэш для соответствующего пользователя после обновления подписки
    redisKey := fmt.Sprintf("subscriptions:user:%d", userIDInt)
    db.RedisClient.Del(context.Background(), redisKey)
    logger.Debug("Deleted subscriptions cache after updating a subscription", "userID", userIDInt)

    // Также удаляем кэш уведомления (notification_sent:subscription:ID), 
    // ведь если юзер меняет дату вручную, мы, возможно, захотим переслать уведомление заново
    // Удаляем кэш уведомления для данной подписки после обновления
    notificationCacheKey := fmt.Sprintf("notification_sent:subscription:%d", existingSubscription.ID)
    db.RedisClient.Del(context.Background(), notificationCacheKey)
    logger.Debug("Deleted notification cache after updating a subscription", "subscriptionID", existingSubscription.ID)

    logger.Debug("Subscription updated successfully", "subscriptionID", existingSubscription.ID, "userID", userIDInt)

    // Возвращаем всю структуру подписки
    c.JSON(http.StatusOK, existingSubscription)
}

// DeleteSubscription удаляет подписку и все связанные напоминания
func DeleteSubscription(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    id := c.Param("id")
    subscriptionID, err := strconv.Atoi(id)
    if err != nil {
        logger.Warn("Invalid subscription ID", "id", id, "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription ID"})
        return
    }

    var subscription models.Subscription

    // Поиск подписки по ID и проверка принадлежности пользователю
    if err := db.GormDB.Where("id = ? AND user_id = ?", subscriptionID, userIDInt).First(&subscription).Error; err != nil {
        logger.Info("Subscription not found", "id", subscriptionID, "userID", userIDInt)
        c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
        return
    }

    // Удаление всех уведомлений, связанных с подпиской
    if err := db.GormDB.Where("subscription_id = ?", subscriptionID).Delete(&models.Notification{}).Error; err != nil {
        logger.Error("Failed to delete notifications", "subscriptionID", subscriptionID, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notifications"})
        return
    }

    // Удаление подписки
    if err := db.GormDB.Delete(&subscription).Error; err != nil {
        logger.Error("Failed to delete subscription", "id", subscriptionID, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subscription"})
        return
    }

    // Удаление кэша после удаления подписки
    redisKey := fmt.Sprintf("subscriptions:user:%d", userIDInt)
    db.RedisClient.Del(context.Background(), redisKey)
    logger.Debug("Deleted subscriptions cache after deleting a subscription", "userID", userIDInt)

    logger.Debug("Subscription deleted successfully", "subscriptionID", subscriptionID)

    c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}

// GetSubscriptions возвращает все подписки
func GetSubscriptions(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    redisKey := fmt.Sprintf("subscriptions:user:%d", userIDInt)
    ctx := context.Background()

    // Попытка получить данные из кэша
    cachedData, err := db.RedisClient.Get(ctx, redisKey).Result()
    if err == nil {
        logger.Debug("Cache hit for GetSubscriptions", "userID", userIDInt)
        var subscriptions []models.Subscription
        if err := json.Unmarshal([]byte(cachedData), &subscriptions); err == nil {
            c.JSON(http.StatusOK, subscriptions)
            return
        }
        logger.Warn("Failed to unmarshal cached data", "error", err)
    } else {
        logger.Debug("Cache miss for GetSubscriptions", "userID", userIDInt)
    }

    // Если кэш не найден, получаем данные из базы данных
    var subscriptions []models.Subscription
    if err := db.GormDB.Where("user_id = ?", userIDInt).Find(&subscriptions).Error; err != nil {
        logger.Error("Failed to get subscriptions from DB", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get subscriptions"})
        return
    }

    // Кэшируем данные
    subscriptionsJSON, err := json.Marshal(subscriptions)
    if err != nil {
        logger.Warn("Failed to marshal subscriptions for caching", "error", err)
    } else {
        db.RedisClient.Set(ctx, redisKey, subscriptionsJSON, time.Hour).Err()
        logger.Debug("Subscriptions cached successfully", "userID", userIDInt)
    }

    c.JSON(http.StatusOK, subscriptions)
}

// GetSubscriptionByID возвращает подписку по ID
func GetSubscriptionByID(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    id := c.Param("id")
    subscriptionID, err := strconv.Atoi(id)
    if err != nil {
        logger.Warn("Invalid subscription ID", "id", id, "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription ID"})
        return
    }

    var subscription models.Subscription

    // Поиск подписки по ID и проверка принадлежности пользователю
    if err := db.GormDB.Where("id = ? AND user_id = ?", subscriptionID, userIDInt).First(&subscription).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            logger.Debug("Subscription not found", "subscriptionID", subscriptionID, "userID", userIDInt)
            c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
            return
        }
        logger.Error("Failed to retrieve subscription", "subscriptionID", subscriptionID, "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve subscription"})
        return
    }

    logger.Debug("Subscription retrieved successfully", "subscriptionID", subscriptionID, "userID", userIDInt)
    c.JSON(http.StatusOK, subscription)
}

// // Сейчас реализован расчет общей стоимости на фронтенде
// // GetTotalCost возвращает общую стоимость всех подписок
// func GetTotalCost(c *gin.Context) {
//     userID, exists := c.Get("userID")
//     if !exists {
//         logger.Warn("User ID is missing in context")
//         c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
//         return
//     }

//     userIDInt, ok := userID.(int)
//     if !ok {
//         logger.Error("Invalid user ID type in context")
//         c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
//         return
//     }

//     ctx := context.Background()
//     redisKey := fmt.Sprintf("total_cost:user:%d", userIDInt)

//     // Попытка получить данные из кэша
//     cachedData, err := db.RedisClient.Get(ctx, redisKey).Result()
//     if err == nil {
//         logger.Debug("Cache hit for GetTotalCost", "userID", userIDInt)
//         var totalCost float64
//         if err := json.Unmarshal([]byte(cachedData), &totalCost); err == nil {
//             c.JSON(http.StatusOK, gin.H{"total_cost": totalCost})
//             return
//         }
//         logger.Warn("Failed to unmarshal cached total cost", "error", err)
//     } else {
//         logger.Debug("Cache miss for GetTotalCost", "userID", userIDInt)
//     }

//     // Выбор базы данных: PgxPool или GORM
//     var totalCost float64
//     if db.PgxPool != nil {
//         query := `SELECT SUM(cost) FROM subscriptions WHERE user_id = $1`
//         err = db.PgxPool.QueryRow(ctx, query, userIDInt).Scan(&totalCost)
//         if err != nil {
//             logger.Error("Error querying total cost with PgxPool", "error", err)
//             c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to calculate total cost"})
//             return
//         }
//     } else {
//         if err := db.GormDB.Model(&models.Subscription{}).Where("user_id = ?", userIDInt).Select("SUM(cost)").Scan(&totalCost).Error; err != nil {
//             logger.Error("Failed to query total cost using GORM", "error", err)
//             c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to calculate total cost"})
//             return
//         }
//     }

//     // Кэшируем данные
//     totalCostJSON, err := json.Marshal(totalCost)
//     if err != nil {
//         logger.Warn("Failed to marshal total cost for caching", "error", err)
//     } else {
//         db.RedisClient.Set(ctx, redisKey, totalCostJSON, time.Hour).Err()
//         logger.Debug("Total cost cached successfully", "userID", userIDInt)
//     }

//     logger.Debug("Total cost calculated successfully", "totalCost", totalCost, "userID", userIDInt)
//     c.JSON(http.StatusOK, gin.H{"total_cost": totalCost})
// }