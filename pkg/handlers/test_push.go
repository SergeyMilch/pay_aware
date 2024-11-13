package handlers

import (
	"net/http"

	"github.com/SergeyMilch/pay_aware/internal/kafka"
	"github.com/gin-gonic/gin"
)

// TestPushNotification отправляет тестовое push-уведомление
func TestPushNotification(c *gin.Context) {
    userID := c.Param("user_id")
    deviceToken := c.Query("device_token") // Используем токен устройства для теста

    if deviceToken == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Device token is required"})
        return
    }

    message := "Это тестовое push-уведомление"
    err := kafka.SendPushNotification(deviceToken, message)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send notification", "details": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Notification sent successfully", "userID": userID})
}
