package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// InternalAccessMiddleware проверяет, что запрос содержит правильный токен доступа
func InternalAccessMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        expectedToken := os.Getenv("INTERNAL_ACCESS_TOKEN")
        providedToken := c.GetHeader("X-Internal-Access-Token")

        if providedToken != expectedToken {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
            return
        }
        c.Next()
    }
}
