package kafka

import (
	"context"
	"encoding/json"
	"time"

	"github.com/IBM/sarama"
	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
)

// StartKafkaConsumer запускает Kafka consumer
func StartKafkaConsumer(cfg config.KafkaConfig) {
	retryAttempts := 3
	sleepDuration := 5 * time.Second

	err := utils.Retry(retryAttempts, sleepDuration, func() error {
		consumerGroupHandler := &ConsumerGroupHandler{}
		consumer, err := sarama.NewConsumerGroup([]string{cfg.Broker}, "subscription_consumer_group", sarama.NewConfig())
		if err != nil {
			logger.Error("Error creating Kafka consumer group", "error", err)
			return err
		}

		defer consumer.Close()
		ctx := context.Background()
		for {
			if err := consumer.Consume(ctx, []string{cfg.Topic}, consumerGroupHandler); err != nil {
				logger.Error("Error consuming Kafka message", "error", err)
				return err
			}
		}
	})

	if err != nil {
		logger.Error("Failed to initialize Kafka consumer after retries", "error", err)
	}

	logger.Info("Kafka consumer initialized successfully")
}

type ConsumerGroupHandler struct{}

func (h *ConsumerGroupHandler) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (h *ConsumerGroupHandler) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }

func (h *ConsumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		logger.Debug("Message claimed", "value", string(message.Value), "timestamp", message.Timestamp, "topic", message.Topic)

		// Обработка сообщения
		var notification models.Notification
		if err := json.Unmarshal(message.Value, &notification); err != nil {
			logger.Warn("Error unmarshalling Kafka message", "error", err)
			continue
		}

		if notification.UserID == 0 || notification.SubscriptionID == 0 {
			logger.Warn("Invalid notification data: user_id or subscription_id is zero", "userID", notification.UserID, "subscriptionID", notification.SubscriptionID)
			continue
		}

		// Обработка сообщения с валидными данными
		ProcessKafkaMessage(notification)
		session.MarkMessage(message, "")
		logger.Debug("Message processed and marked", "userID", notification.UserID, "subscriptionID", notification.SubscriptionID)
	}
	return nil
}