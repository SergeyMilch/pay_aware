package middleware

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func AuthorizeJWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        tokenString := c.GetHeader("Authorization")
        if tokenString == "" {
            logger.Warn("Missing authorization token")
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization token"})
            c.Abort()
            return
        }

        // Извлекаем токен после префикса "Bearer "
        tokenString = strings.TrimPrefix(tokenString, "Bearer ")
        if tokenString == "" {
            logger.Warn("Invalid authorization format")
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
            c.Abort()
            return
        }

        // Проверка алгоритма подписи перед парсингом токена
        parts := strings.Split(tokenString, ".")
        if len(parts) != 3 {
            logger.Warn("Invalid JWT format")
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        // Декодируем и проверяем заголовок
        headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
        if err != nil {
            logger.Warn("Failed to decode JWT header", "error", err)
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        var header struct {
            Alg string `json:"alg"`
        }
        if err := json.Unmarshal(headerJSON, &header); err != nil || header.Alg != jwt.SigningMethodHS256.Alg() {
            logger.Warn("Unexpected signing method", "alg", header.Alg)
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        // Теперь безопасно парсим токен
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil {
            if ve, ok := err.(*jwt.ValidationError); ok {
                if ve.Errors&jwt.ValidationErrorExpired != 0 {
                    logger.Warn("Expired token")
                    c.JSON(http.StatusUnauthorized, gin.H{"error": "Token has expired"})
                } else {
                    logger.Warn("Invalid token", "error", err)
                    c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                }
            } else {
                logger.Warn("Invalid token", "error", err)
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            }
            c.Abort()
            return
        }

        if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
            // Проверяем срок действия токена
            if exp, ok := claims["exp"].(float64); ok {
                expirationTime := time.Unix(int64(exp), 0).UTC()
                logger.Debug("Token expiration time", "expires_at", expirationTime)

                if expirationTime.Before(time.Now().UTC()) {
                    logger.Warn("Token has expired", "expires_at", expirationTime)
                    c.JSON(http.StatusUnauthorized, gin.H{"error": "Token has expired"})
                    c.Abort()
                    return
                }
            } else {
                logger.Warn("Missing expiration in token claims")
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                c.Abort()
                return
            }

            // Извлекаем userID из claims и добавляем в контекст
            userID, ok := claims["user_id"].(float64)
            if !ok {
                logger.Warn("User ID missing in token claims")
                c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
                c.Abort()
                return
            }

            // Добавляем userID в контекст
            c.Set("userID", int(userID))
            logger.Debug("Token validated successfully", "userID", int(userID))
            c.Next()
        } else {
            logger.Warn("Invalid JWT claims")
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
        }
    }
}