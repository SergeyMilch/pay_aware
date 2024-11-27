package auth

import (
	"fmt"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/golang-jwt/jwt/v4"
)

func GenerateJWT(userID int, secret string, duration time.Duration) (string, error) {
    claims := jwt.MapClaims{
        "authorized": true,
        "user_id":    userID,
        "exp":        time.Now().UTC().Add(duration).Unix(),
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

func ValidateResetToken(tokenStr string) (int, error) {
    logger.Debug("Validating reset token")

    token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
        return []byte(config.LoadConfig().JWTSecret), nil
    })

    if err != nil || !token.Valid {
        logger.Error("Invalid or expired reset token", "error", err)
        return 0, err
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        err := fmt.Errorf("invalid token claims")
        logger.Error("Failed to parse token claims", "error", err)
        return 0, err
    }

    userID, ok := claims["user_id"].(float64)
    if !ok {
        err := fmt.Errorf("user ID not found in token")
        logger.Error("Failed to extract user ID from token", "error", err)
        return 0, err
    }

    logger.Debug("Reset token validated successfully", "user_id", int(userID))
    return int(userID), nil
}