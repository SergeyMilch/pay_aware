package models

import (
	"gorm.io/gorm"
)

type User struct {
    gorm.Model
    Name       string `json:"name"`
    Email      string `json:"email" gorm:"unique"`
    Password   string `json:"password,omitempty"` // Принимаем пароль, но не передаем обратно
    DeviceToken string `json:"device_token,omitempty"`
}
