package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/IBM/sarama"
	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	expo "github.com/oliveroneill/exponent-server-sdk-golang/sdk"
	"gorm.io/gorm"
)

// KafkaProducer инкапсулирует Kafka producer и тему
type KafkaProducer struct {
	producer sarama.SyncProducer
	topic    string
}

// InitKafka инициализирует Kafka producer и возвращает экземпляр KafkaProducer
func InitKafka(cfg config.KafkaConfig) (*KafkaProducer, error) {
	kafkaBroker := cfg.Broker
	retryTimeout := 60 * time.Second

	logger.Info("Waiting for Kafka readiness before connecting...")
	if !utils.WaitForKafkaReady(kafkaBroker, retryTimeout) {
		logger.Error("Kafka is not ready after waiting; aborting connection attempts")
		return nil, fmt.Errorf("kafka not ready")
	}

	retryAttempts := 3
	sleepDuration := 5 * time.Second

	var producer sarama.SyncProducer
	err := utils.Retry(retryAttempts, sleepDuration, func() error {
		producerConfig := sarama.NewConfig()
		producerConfig.Producer.Return.Successes = true

		// Настройка SSL, если флаг `UseSSL` установлен в true
		if cfg.UseSSL {
			producerConfig.Net.TLS.Enable = true
			tlsConfig, err := utils.CreateTLSConfiguration(cfg.Truststore, cfg.TruststorePassword)
			if err != nil {
				logger.Error("Failed to create TLS configuration", "error", err)
				return err
			}
			producerConfig.Net.TLS.Config = tlsConfig
		}

		// Создание нового Kafka producer
		var err error
		producer, err = sarama.NewSyncProducer([]string{kafkaBroker}, producerConfig)
		if err != nil {
			logger.Warn("Failed to connect to Kafka, retrying...", "error", err)
			return err
		}
		return nil
	})

	if err != nil {
		logger.Error("Failed to initialize Kafka producer after retries", "error", err)
		return nil, err
	}

	logger.Debug("Kafka producer successfully initialized", "broker", kafkaBroker, "topic", cfg.Topic)
	return &KafkaProducer{producer: producer, topic: cfg.Topic}, nil
}

// Close завершает соединение с Kafka producer
func (kp *KafkaProducer) Close() error {
	if kp.producer != nil {
		if err := kp.producer.Close(); err != nil {
			logger.Error("Failed to close Kafka producer", "error", err)
			return err
		}
		logger.Info("Kafka producer closed successfully")
	}
	return nil
}

// NotificationMessage представляет сообщение уведомления
type NotificationMessage struct {
	UserID  int    `json:"user_id"`
	Message string `json:"message"`
}

// SendNotification отправляет уведомление в Kafka
func (kp *KafkaProducer) SendNotification(ctx context.Context, notification NotificationMessage) error {
	if kp.producer == nil {
		logger.Warn("Kafka producer is not initialized; skipping notification send", "userID", notification.UserID)
		return fmt.Errorf("kafka producer is not initialized")
	}

	message, err := json.Marshal(notification)
	if err != nil {
		logger.Error("Failed to marshal notification message", "userID", notification.UserID)
		return err
	}

	msg := &sarama.ProducerMessage{
		Topic: kp.topic,
		Key:   sarama.StringEncoder(fmt.Sprintf("user-%d", notification.UserID)),
		Value: sarama.ByteEncoder(message),
	}

	_, _, err = kp.producer.SendMessage(msg)
	if err != nil {
		logger.Error("Failed to send message to Kafka", "userID", notification.UserID)
		return err
	}

	// Log на уровне отладки, чтобы не раскрывать содержимое сообщений в производственных logs
	logger.Info("Notification sent successfully", "userID", notification.UserID)
	logger.Debug("Notification sent with message content", "userID", notification.UserID, "message", notification.Message)
	return nil
}

// SendPushNotification отправляет push-уведомление с использованием Expo Push API
func SendPushNotification(deviceToken, message string, highPriority bool) error {
	client := expo.NewPushClient(nil)

	// Создаем сообщение для отправки
	pushToken := expo.ExponentPushToken(deviceToken)

	pushMessage := expo.PushMessage{
		To:    []expo.ExponentPushToken{pushToken},
		Sound: "default",
		Title: "Напоминание об оплате!",
		Body:  message,
		ChannelID: "payment-reminders", // <--- добавляем channelId
	}

	if highPriority {
        pushMessage.Title = "⚠️Напоминание об оплате!"
    }

	// if highPriority {
    //     // Добавляем дополнительные данные для заметного уведомления
    //     imageURL := os.Getenv("ICON_PUSH_FILES_URL")
    //     pushMessage.Data = map[string]string{
    //         "image": imageURL,
    //     }
    //     pushMessage.Title = "❗🔔⚠️💳 Напоминание об оплате!"
    // }

	// Отправляем уведомление
	response, err := client.Publish(&pushMessage)
	if err != nil {
		logger.Error("Failed to send push notification", "error", err)
		return fmt.Errorf("failed to send push notification: %v", err)
	}

	// Проверяем наличие ошибок в ответе
	if err := response.ValidateResponse(); err != nil {
		logger.Warn("Push notification request failed", "error", err)
		return fmt.Errorf("push notification request failed: %v", err)
	}

    // Проверяем детальные статусы
	// Обрабатываем результаты отправки
    if pushErr, ok := err.(*expo.PushResponseError); ok {
		if pushErr.Response != nil && pushErr.Response.Details != nil {
			if errDetail, exists := pushErr.Response.Details["error"]; exists {
				switch errDetail {
				case expo.ErrorDeviceNotRegistered, "InvalidToken":
					logger.Warn("Invalid device token. Removing from DB", "token", deviceToken)
					// Удаляем/обнуляем токен в БД
					go removeDeviceTokenByValue(deviceToken)
				case expo.ErrorMessageTooBig:
					logger.Error("Message too big", "token", deviceToken)
				case expo.ErrorMessageRateExceeded:
					logger.Error("Message rate exceeded", "token", deviceToken)
				case "InvalidCredentials":
					logger.Error("Invalid Expo credentials provided")
					// Возможно, требуется обновить токены или проверить конфигурацию
				default:
					logger.Warn("Unhandled error from Expo", "error", errDetail)
				}
			}
		}
	}

	logger.Info("Push notification sent successfully")
	logger.Debug("Push notification sent with content", "deviceToken", deviceToken, "message", message)
	return nil
}

// removeDeviceTokenByValue ищет пользователя с таким deviceToken и обнуляет поле device_token
func removeDeviceTokenByValue(token string) {
    if token == "" {
        return
    }
    var user models.User
    if err := db.GormDB.Where("device_token = ?", token).First(&user).Error; err != nil {
        if err == gorm.ErrRecordNotFound {
            logger.Warn("No user found with this device token", "token", token)
        } else {
            logger.Error("Error while searching user by token", "error", err)
        }
        return
    }

    user.DeviceToken = ""
    if err := db.GormDB.Save(&user).Error; err != nil {
        logger.Error("Failed to clear device token", "userID", user.ID, "error", err)
    } else {
        logger.Info("Device token cleared successfully", "userID", user.ID)
    }
}