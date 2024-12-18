package models

import (
	"time"

	"gorm.io/gorm"
)

type Subscription struct {
    gorm.Model
    UserID            int            `json:"user_id" gorm:"index:idx_user_nextpayment"`
    ServiceName       string         `json:"service_name"`
    Cost              float64        `json:"cost"`
    NextPaymentDate   time.Time      `json:"next_payment_date" gorm:"type:timestamptz;index:idx_user_nextpayment"`
    NotificationOffset int           `json:"notification_offset"`
    NotificationDate  time.Time      `json:"notification_date" gorm:"type:timestamptz;index"`
    Notifications     []Notification `gorm:"foreignKey:SubscriptionID;constraint:onDelete:CASCADE;"`
}
