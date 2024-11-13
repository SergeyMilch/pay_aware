package auth

import (
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/golang-jwt/jwt/v4"
)

func GenerateJWT(userID int, secret string) (string, error) {
    // Задаем срок действия токена
    claims := jwt.MapClaims{
        "authorized": true,
        "user_id":    userID,
        "exp":        time.Now().UTC().Add(14 * 24 * time.Hour).Unix(),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    signedToken, err := token.SignedString([]byte(secret))
    if err != nil {
        logger.Error("Failed to generate JWT token", "user_id", userID, "error", err)
        return "", err
    }

    logger.Debug("JWT token generated successfully", "user_id", userID)
    return signedToken, nil
}
