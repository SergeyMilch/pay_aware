package utils

import (
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
    logger.Debug("Hashing password")
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        logger.Error("Failed to hash password", "error", err)
    }
    return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
    logger.Debug("Checking password hash")
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    if err != nil {
        logger.Warn("Password hash check failed", "error", err)
    }
    return err == nil
}
