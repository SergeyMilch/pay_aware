package models

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
    gorm.Model
    UserID         int       `json:"user_id" gorm:"index:idx_subscription_user_sentat;index:idx_user_status"`
    SubscriptionID int       `json:"subscription_id" gorm:"index:idx_subscription_user_sentat"` // Внешний ключ для привязки к подписке
    Message        string    `json:"message"`
    SentAt         time.Time `json:"sent_at" gorm:"type:timestamptz;index:idx_subscription_user_sentat"` // Время отправки уведомления
    Status         string    `json:"status" gorm:"index:idx_user_status"` // Статус отправки (например, "success" или "failed")
    ReadAt         *time.Time `json:"read_at" gorm:"type:timestamptz;index"` // Для истории уведомлений (пометки прочитанным)

    Subscription   Subscription `json:"subscription" gorm:"foreignKey:SubscriptionID"`
}
