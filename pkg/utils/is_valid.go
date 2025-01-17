package utils

import (
	"regexp"
	"unicode"

	"github.com/SergeyMilch/pay_aware/internal/logger"
)

// IsValidEmail проверяет формат email с помощью регулярного выражения
func IsValidEmail(email string) bool {
	logger.Debug("Validating email format")

	// Регулярное выражение для проверки email
	var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		logger.Warn("Invalid email format", "email", email)
		return false
	}
	logger.Debug("Email format is valid")
	return true
}

// IsValidPassword проверяет пароль на соответствие минимальным требованиям безопасности
func IsValidPassword(password string) bool {
	logger.Debug("Validating password security requirements")

	var hasMinLen, hasUpper, hasLower, hasNumber, hasSpecial bool
	const minLen = 6

	if len(password) >= minLen {
		hasMinLen = true
	}

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// Логируем недостающие требования к паролю
	if !hasMinLen {
		logger.Warn("Password does not meet minimum length requirement", "required_length", minLen)
	}
	if !hasUpper {
		logger.Warn("Password does not contain an uppercase letter")
	}
	if !hasLower {
		logger.Warn("Password does not contain a lowercase letter")
	}
	if !hasNumber {
		logger.Warn("Password does not contain a digit")
	}
	if !hasSpecial {
		logger.Warn("Password does not contain a special character")
	}

	if hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial {
		logger.Debug("Password meets all security requirements")
		return true
	}

	return false
}

// containsSpace - функция для проверки пробелов
func ContainsSpace(s string) bool {
	for _, r := range s {
		if r == ' ' {
			return true
		}
	}
	return false
}