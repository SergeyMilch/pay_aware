package models

import (
	"gorm.io/gorm"
)

type User struct {
    gorm.Model
    Name       string `json:"name"`
    Email      string `json:"email"` // убираем gorm:"uniqueIndex" и создаем в коде индекс записей, у которых deleted_at IS NULL
    Password   string `json:"password,omitempty"` // Принимаем пароль, но не передаем обратно
    DeviceToken string `json:"device_token,omitempty" gorm:"index"`
    PinCode     string `json:"pin_code,omitempty"` // Добавляем поле для ПИН-кода

    Subscriptions []Subscription `json:"subscriptions" gorm:"constraint:OnDelete:CASCADE;"`
}
