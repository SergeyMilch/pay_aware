package kafka

import (
	"fmt"

	"github.com/IBM/sarama"
	"github.com/SergeyMilch/pay_aware/internal/logger"
)

// SendMessage отправляет сообщение в Kafka с использованием KafkaProducer
func (kp *KafkaProducer) SendMessage(message string) error {
	if kp.producer == nil {
		logger.Warn("Kafka producer is not initialized")
		return fmt.Errorf("kafka producer is not initialized")
	}

	msg := &sarama.ProducerMessage{
		Topic: kp.topic,
		Value: sarama.StringEncoder(message),
	}

	_, _, err := kp.producer.SendMessage(msg)
	if err != nil {
		logger.Error("Failed to send Kafka message", "error", err, "topic", kp.topic)
		return err
	}

	logger.Info("Message sent to Kafka", "topic", kp.topic)

	logger.Debug("Message content", "topic", kp.topic, "message", message)
	return nil
}
