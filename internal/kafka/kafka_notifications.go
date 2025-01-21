package kafka

import (
	"fmt"
	"strings"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"golang.org/x/exp/rand"
)

// ProcessKafkaMessage обрабатывает сообщения из Kafka и отправляет уведомления
func ProcessKafkaMessage(notification models.Notification) {
    // Проверка обязательных полей
    if notification.SubscriptionID == 0 {
        logger.Error("Invalid Kafka message: missing required fields", "notification", notification)
        return
    }

    // Найти подписку по `subscription_id`
    var subscription models.Subscription
    if err := db.GormDB.First(&subscription, notification.SubscriptionID).Error; err != nil {
        logger.Error("Не удалось найти подписку для отправки уведомления", "subscriptionID", notification.SubscriptionID, "error", err)
        return
    }

    // Найти пользователя, связанного с подпиской
    var user models.User
    if err := db.GormDB.First(&user, subscription.UserID).Error; err != nil {
        logger.Error("Не удалось найти пользователя для отправки уведомления", "userID", subscription.UserID, "error", err)
        return
    }

    // Проверить наличие DeviceToken
    if user.DeviceToken == "" {
        logger.Warn("Device token is missing for user", "userID", user.ID)
        return
    }

    // Сформировать сообщение с учетом предпочтений пользователя
    var message string
    if subscription.HighPriority {
        message = fmt.Sprintf("Не забудьте оплатить❗\n• Сервис: «%s»\n• Стоимость: %v ₽", 
            strings.ToUpper(subscription.ServiceName), 
            subscription.Cost)
    } else {
        message = fmt.Sprintf("Не забудьте оплатить\n• Сервис: «%s»\n• Стоимость: %v ₽", 
            strings.ToUpper(subscription.ServiceName), 
            subscription.Cost)
    }

    // Добавляем случайную задержку (джиттер) перед отправкой уведомления
    jitter := time.Duration(rand.Intn(120)) * time.Second
    logger.Debug("Adding jitter before sending notification", "subscriptionID", subscription.ID, "jitter", jitter)

    // Используем time.AfterFunc для вызова функции с задержкой
    time.AfterFunc(jitter, func() {
        // Отправка push-уведомления
        if err := SendPushNotification(user.DeviceToken, message, subscription.HighPriority); err != nil {
            logger.Error("Не удалось отправить уведомление", "userID", user.ID, "error", err)
            // Сохраняем неудачную отправку
            notification.Status = "failed"
        } else {
            logger.Info("Push notification sent successfully", "userID", user.ID, "subscriptionID", subscription.ID)
            // Сохраняем успешную отправку
            notification.Status = "success"
            notification.SentAt = time.Now().UTC()
        }

        // Сохраняем факт отправки уведомления в базу данных
        if err := db.GormDB.Create(&notification).Error; err != nil {
            logger.Error("Не удалось сохранить уведомление в БД", "userID", user.ID, "error", err)
        }
    })
}

