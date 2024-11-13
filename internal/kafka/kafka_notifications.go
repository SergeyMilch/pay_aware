package kafka

import (
	"fmt"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
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

    // Сформировать сообщение с названием подписки
    message := fmt.Sprintf("Не забудьте оплатить подписку на %s!", subscription.ServiceName)

    // Отправка push-уведомления
    if err := SendPushNotification(user.DeviceToken, message); err != nil {
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
}
