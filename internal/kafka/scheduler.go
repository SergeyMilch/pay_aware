package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/go-redis/redis/v8"
	"github.com/robfig/cron/v3"
)

// StartNotificationScheduler инициализирует CRON-задачу для уведомлений
func (kp *KafkaProducer) StartNotificationScheduler() {
	c := cron.New()
	ctx := context.Background()

	// Запускаем CRON-задачу каждые 5 минут
	_, err := c.AddFunc("*/5 * * * *", func() {
		var subscriptions []models.Subscription
		currentTime := time.Now().UTC()
		nextCheckTime := currentTime.Add(15 * time.Minute)

		// Ищем подписки, для которых необходимо отправить уведомление в ближайшие 15 минут
		db.GormDB.Where("notification_date BETWEEN ? AND ?", currentTime, nextCheckTime).Find(&subscriptions)

		for _, subscription := range subscriptions {
			if subscription.NotificationOffset == 0 {
				continue
			}

			notificationTime := subscription.NextPaymentDate.Add(-time.Duration(subscription.NotificationOffset) * time.Minute)
			if notificationTime.Before(nextCheckTime) && notificationTime.After(currentTime) ||
   				notificationTime.Equal(currentTime) || notificationTime.Equal(nextCheckTime)  {
				cacheKey := fmt.Sprintf("notification_sent:subscription:%d", subscription.ID)
				// Проверяем, не отправлено ли уже уведомление для этой подписки
				if _, err := db.RedisClient.Get(ctx, cacheKey).Result(); err == redis.Nil {
					if subscription.ID == 0 {
						logger.Error("Invalid subscription ID, skipping notification", "subscription", subscription)
						continue
					}

					message := models.Notification{
						UserID:         subscription.UserID,
						SubscriptionID: int(subscription.ID),
						Message:        fmt.Sprintf("Не забудьте оплатить подписку на %s!", subscription.ServiceName),
					}

					// Сериализуем уведомление в JSON и отправляем в Kafka
					messageBytes, err := json.Marshal(message)
					if err != nil {
						logger.Error("Failed to marshal notification", "error", err)
						continue
					}

					if err := kp.SendMessage(string(messageBytes)); err != nil {
						logger.Error("Failed to send message to Kafka", "error", err, "subscriptionID", subscription.ID)
						continue
					}

					// Кэшируем информацию об отправленном уведомлении
					err = db.RedisClient.Set(ctx, cacheKey, "sent", time.Until(subscription.NextPaymentDate)).Err()
					if err != nil {
						logger.Warn("Failed to set cache for notification", "subscriptionID", subscription.ID, "error", err)
					} else {
						logger.Debug("Notification cached successfully", "subscriptionID", subscription.ID)
					}
					logger.Info("Notification sent and cached", "subscriptionID", subscription.ID)
				}
			}
		}
	})

	if err != nil {
		logger.Error("Failed to schedule notification task", "error", err)
		return
	}

	c.Start()
	logger.Info("Notification scheduler started")
}
