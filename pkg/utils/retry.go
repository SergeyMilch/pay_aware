package utils

import (
	"fmt"
	"net"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
)

// Retry функция для повторных попыток выполнения переданной функции
func Retry(attempts int, sleep time.Duration, fn func() error) error {
    for i := 0; i < attempts; i++ {
        if err := fn(); err != nil {
            logger.Warn("Attempt failed", "attempt", i+1, "error", err)
            time.Sleep(sleep)
        } else {
            return nil
        }
    }
    logger.Error("All attempts failed after retries", "attempts", attempts)
    return fmt.Errorf("all attempts failed")
}

// WaitForKafkaReady динамически проверяет готовность Kafka перед подключением
func WaitForKafkaReady(broker string, timeout time.Duration) bool {
    start := time.Now()
    for {
        conn, err := net.DialTimeout("tcp", broker, 5*time.Second)
        if err == nil {
            conn.Close()
            logger.Info("Kafka connection established")
            logger.Debug("Kafka is ready", "broker", broker)
            return true
        }
        if time.Since(start) > timeout {
            logger.Error("Kafka connection timeout reached", "timeout", timeout)
            logger.Debug("Kafka connection timeout reached for broker", "broker", broker, "timeout", timeout)
            return false
        }
        logger.Debug("Retrying Kafka connection", "broker", broker)
        time.Sleep(5 * time.Second) // Задержка перед новой попыткой
    }
}