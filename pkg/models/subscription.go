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
    NextPaymentDate   time.Time      `json:"next_payment_date" gorm:"type:timestamptz;index:idx_user_nextpayment"` // Дата напоминания (разделили даты на напоминание и списание)
    NotificationOffset int           `json:"notification_offset"`
    NotificationDate  time.Time      `json:"notification_date" gorm:"type:timestamptz;index"`
    Notifications     []Notification `gorm:"foreignKey:SubscriptionID;constraint:onDelete:CASCADE;"`
    RecurrenceType    string         `json:"recurrence_type"` // Новое поле для указания типа повторения: "monthly", "yearly" или ""
    Tag               string         `json:"tag" gorm:"index:idx_tag"` // <-- добавляем для фильтра
    HighPriority      bool           `json:"high_priority"` // Новое поле для выбора типа уведомления
}
