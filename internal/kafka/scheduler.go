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

const workerCount = 10 // Количество параллельных воркеров

// StartNotificationScheduler инициализирует CRON-задачу для уведомлений
func (kp *KafkaProducer) StartNotificationScheduler() {
    c := cron.New()
    ctx := context.Background()

    // Создаём канал для уведомлений
    notificationChan := make(chan models.Subscription, 100)

    // Запускаем воркеры
    for i := 0; i < workerCount; i++ {
        go kp.notificationWorker(ctx, notificationChan)
    }

    // Добавляем CRON-функцию, выполняющуюся каждую минуту
    _, err := c.AddFunc("* * * * *", func() {
        var subscriptions []models.Subscription
        currentTime := time.Now().UTC()
        nextCheckTime := currentTime.Add(2 * time.Minute) // Сокращенное окно проверки

        // Ищем подписки, для которых необходимо отправить уведомление в ближайшие 2 минуты
        db.GormDB.Where("notification_date BETWEEN ? AND ?", currentTime, nextCheckTime).Find(&subscriptions)

        for _, subscription := range subscriptions {
            // Вычисляем NotificationTime
            notificationTime := subscription.NextPaymentDate.Add(-time.Duration(subscription.NotificationOffset) * time.Minute)

            // Если NotificationOffset == 0, то notificationTime == NextPaymentDate
            if (notificationTime.Before(nextCheckTime) && notificationTime.After(currentTime)) ||
                notificationTime.Equal(currentTime) || notificationTime.Equal(nextCheckTime) {
                
                cacheKey := fmt.Sprintf("notification_sent:subscription:%d", subscription.ID)
                // Проверяем, не отправлено ли уже уведомление для этой подписки
                if _, err := db.RedisClient.Get(ctx, cacheKey).Result(); err == redis.Nil {
                    if subscription.ID == 0 {
                        logger.Error("Invalid subscription ID, skipping notification", "subscription", subscription)
                        continue
                    }

                    // Отправляем подписку в канал для обработки воркерами
                    select {
                    case notificationChan <- subscription:
                        logger.Debug("Subscription sent to notification channel", "subscriptionID", subscription.ID)
                    default:
                        logger.Warn("Notification channel is full, skipping subscription", "subscriptionID", subscription.ID)
                    }
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

// Воркер для обработки уведомлений
func (kp *KafkaProducer) notificationWorker(ctx context.Context, notificationChan <-chan models.Subscription) {
    for subscription := range notificationChan {
        kp.processSubscription(ctx, subscription)
    }
}

// Функция обработки подписки
func (kp *KafkaProducer) processSubscription(ctx context.Context, subscription models.Subscription) {
    if subscription.ID == 0 {
        logger.Error("Invalid subscription ID, skipping notification", "subscription", subscription)
        return
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
        return
    }

    if err := kp.SendMessage(string(messageBytes)); err != nil {
        logger.Error("Failed to send message to Kafka", "error", err, "subscriptionID", subscription.ID)
        return
    }

    // Ставим флаг в Redis, чтобы уведомление не отправлялось повторно
    cacheKey := fmt.Sprintf("notification_sent:subscription:%d", subscription.ID)
    err = db.RedisClient.Set(ctx, cacheKey, "sent", time.Until(subscription.NextPaymentDate)).Err()
    if err != nil {
        logger.Warn("Failed to set cache for notification", "subscriptionID", subscription.ID, "error", err)
    } else {
        logger.Debug("Notification cached successfully", "subscriptionID", subscription.ID)
    }
    logger.Info("Notification sent and cached", "subscriptionID", subscription.ID)

    // === ВАЖНО: если подписка повторяющаяся — сдвигаем дату. ===
    if subscription.RecurrenceType == "monthly" || subscription.RecurrenceType == "yearly" {
        // Сдвигаем NextPaymentDate на 1 месяц / 1 год вперёд
        if subscription.RecurrenceType == "monthly" {
            subscription.NextPaymentDate = subscription.NextPaymentDate.AddDate(0, 1, 0)
        } else if subscription.RecurrenceType == "yearly" {
            subscription.NextPaymentDate = subscription.NextPaymentDate.AddDate(1, 0, 0)
        }

        // Пересчитываем NotificationDate
        subscription.NotificationDate = subscription.NextPaymentDate.Add(
            -time.Duration(subscription.NotificationOffset) * time.Minute,
        )

        // Сохраняем обновлённую подписку
        if err := db.GormDB.Save(&subscription).Error; err != nil {
            logger.Error("Failed to update subscription date in cron", "error", err)
            return
        }

        // Удаляем кэш с подписками пользователя, чтобы при следующем запросе фронт знал о новой дате
        redisKey := fmt.Sprintf("subscriptions:user:%d", subscription.UserID)
        db.RedisClient.Del(ctx, redisKey)
        logger.Info("Subscription nextPaymentDate shifted for recurring subscription",
            "subscriptionID", subscription.ID,
            "recurrenceType", subscription.RecurrenceType)
    }
    // === Конец блока сдвига дат ===
}