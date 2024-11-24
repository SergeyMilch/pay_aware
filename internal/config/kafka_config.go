package config

import (
	"os"
	"strconv"

	"github.com/SergeyMilch/pay_aware/internal/logger"
)

type KafkaConfig struct {
	Broker             string
	Topic              string
	UseSSL             bool
	Truststore         string
	TruststorePassword string
}

func LoadKafkaConfig() KafkaConfig {
	useSSL, err := strconv.ParseBool(os.Getenv("KAFKA_USE_SSL"))
	if err != nil {
		useSSL = false // Используем false, если ошибка или значение не задано
	}

	cfg := KafkaConfig{
		Broker:            os.Getenv("KAFKA_BROKER"),
		Topic:             os.Getenv("KAFKA_TOPIC"),
		UseSSL:            useSSL,
	}

	// Добавляем SSL-конфигурацию, если UseSSL установлен в true
	if useSSL {
		cfg.Truststore = os.Getenv("KAFKA_CFG_SSL_TRUSTSTORE_LOCATION")
		cfg.TruststorePassword = os.Getenv("KAFKA_CFG_SSL_TRUSTSTORE_PASSWORD")
	}

	if cfg.Broker == "" || cfg.Topic == "" {
		logger.Error("Critical Kafka environment variables are missing. Shutting down.")
		os.Exit(1)
	}

	return cfg
}
