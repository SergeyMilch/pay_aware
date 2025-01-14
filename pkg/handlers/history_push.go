package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/gin-gonic/gin"
)

// GetUserNotifications обрабатывает GET-запросы для получения истории уведомлений пользователя
func GetUserNotifications(c *gin.Context) {
	// Извлекаем userID из контекста. Предполагается, что middleware аутентификации добавляет его.
	userID, exists := c.Get("userID")
	if !exists {
		logger.Error("userID не найден в контексте запроса")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userID.(int)
	if !ok {
		logger.Error("userID имеет неправильный тип")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Извлекаем параметры пагинации из запроса
	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")

	limit := 20 // Значение по умолчанию
	offset := 0
	var err error

	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			logger.Warn("Некорректное значение limit:", limitStr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}
	}

	if offsetStr != "" {
		offset, err = strconv.Atoi(offsetStr)
		if err != nil || offset < 0 {
			logger.Warn("Некорректное значение offset:", offsetStr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter"})
			return
		}
	}

	var notifications []models.Notification
	// Выполняем запрос с предзагрузкой подписки
	if err := db.GormDB.Preload("Subscription").
		Where("user_id = ?", userID).
		Order("sent_at desc").
		Limit(limit).
		Offset(offset).
		Find(&notifications).Error; err != nil {
		logger.Error("Ошибка при получении уведомлений:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkNotificationAsRead обрабатывает POST-запрос для отметки уведомления как прочитанного
func MarkNotificationAsRead(c *gin.Context) {
	// Извлекаем userID из контекста
	userID, exists := c.Get("userID")
	if !exists {
		logger.Error("userID не найден в контексте запроса")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userID.(int)
	if !ok {
		logger.Error("userID имеет неправильный тип")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Извлекаем ID уведомления из URL-параметров
	notificationIDStr := c.Param("id")
	notificationID, err := strconv.Atoi(notificationIDStr)
	if err != nil {
		logger.Warn("Некорректный ID уведомления:", notificationIDStr)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	var notification models.Notification
	// Находим уведомление
	if err := db.GormDB.First(&notification, notificationID).Error; err != nil {
		logger.Error("Уведомление не найдено:", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	// Проверяем, принадлежит ли уведомление текущему пользователю
	if notification.UserID != userID {
		logger.Warn("Пользователь пытается получить доступ к чужому уведомлению")
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	// Обновляем поле ReadAt
	now := time.Now().UTC()
	notification.ReadAt = &now

	if err := db.GormDB.Save(&notification).Error; err != nil {
		logger.Error("Не удалось обновить уведомление:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}

	c.JSON(http.StatusOK, notification)
}