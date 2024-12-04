package models

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
    gorm.Model
    UserID         int       `json:"user_id"`
    SubscriptionID int       `json:"subscription_id"` // Внешний ключ для привязки к подписке
    Message        string    `json:"message"`
    SentAt         time.Time `json:"sent_at" gorm:"type:timestamptz"` // Время отправки уведомления
    Status         string    `json:"status"` // Статус отправки (например, "success" или "failed")
}
