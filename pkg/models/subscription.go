package models

import (
	"time"

	"gorm.io/gorm"
)

type Subscription struct {
    gorm.Model
    UserID            int            `json:"user_id"`
    ServiceName       string         `json:"service_name"`
    Cost              float64        `json:"cost"`
    NextPaymentDate   time.Time      `json:"next_payment_date" gorm:"type:timestamp without time zone"`
    NotificationOffset int           `json:"notification_offset"`
    NotificationDate  time.Time      `json:"notification_date" gorm:"type:timestamp without time zone"`
    Notifications     []Notification `gorm:"foreignKey:SubscriptionID;constraint:onDelete:CASCADE;"`
}
