package config

import (
	"os"

	"github.com/SergeyMilch/pay_aware/internal/logger"
)

type KafkaConfig struct {
	Broker string
	Topic  string
}

func LoadKafkaConfig() KafkaConfig {
	cfg := KafkaConfig{
		Broker: os.Getenv("KAFKA_BROKER"),
		Topic:  os.Getenv("KAFKA_TOPIC"),
	}

	if cfg.Broker == "" || cfg.Topic == "" {
		logger.Error("Critical Kafka environment variables are missing. Shutting down.")
		os.Exit(1)
	}
	
	return cfg
}
