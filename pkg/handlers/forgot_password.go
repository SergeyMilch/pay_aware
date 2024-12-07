package handlers

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/auth"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"github.com/gin-gonic/gin"
)

func ForgotPassword(c *gin.Context) {
    var request struct {
        Email string `json:"email"`
    }

    if err := c.ShouldBindJSON(&request); err != nil {
        logger.Warn("Invalid email format", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format"})
        return
    }

    // Проверяем, существует ли пользователь с таким email
    var user models.User
    if err := db.GormDB.Where("email = ?", request.Email).First(&user).Error; err != nil {
        logger.Info("Email not found", "email", request.Email)
        // Возвращаем стандартное сообщение, чтобы не раскрывать информацию о пользователе
        c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link will be sent"})
        return
    }

    // Генерируем токен для сброса пароля
    token, err := auth.GenerateJWT(int(user.ID), config.LoadConfig().JWTSecret, 15*time.Minute)
    if err != nil {
        logger.Error("Failed to generate reset token", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
        return
    }

  // Отправляем email с ссылкой для сброса пароля
  resetLink := fmt.Sprintf("%s/reset-password?token=%s", os.Getenv("RESET_PASSWORD_URL"), token)
    emailBody := fmt.Sprintf(`<p>Чтобы сбросить ваш пароль, нажмите на следующую ссылку:</p><a href="%s">Сбросить пароль</a>`, resetLink)

    err = utils.SendEmail(user.Email, "Password Reset Request", emailBody)
    if err != nil {
        logger.Error("Failed to send reset email", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reset email"})
        return
    }

    // Возвращаем стандартное сообщение
    c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link will be sent"})
}

func ResetPassword(c *gin.Context) {
    var request struct {
        Token       string `json:"token"`
        NewPassword string `json:"new_password"`
    }

    // Парсим JSON-запрос
    if err := c.ShouldBindJSON(&request); err != nil {
        logger.Warn("Invalid reset password request", "error", err, "body", c.Request.Body)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    // Проверяем токен
    userID, err := auth.ValidateResetToken(request.Token)
    if err != nil {
        logger.Warn("Invalid or expired token", "error", err, "token", request.Token)
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
        return
    }

    // Хэшируем новый пароль
    hashedPassword, err := utils.HashPassword(request.NewPassword)
    if err != nil {
        logger.Error("Failed to hash password", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
        return
    }

    // Обновляем пароль и очищаем PIN-код
    result := db.GormDB.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
        "password": hashedPassword,
        "pin_code": nil,
    })
    if result.Error != nil {
        logger.Error("Failed to update password", "error", result.Error)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
        return
    }
    if result.RowsAffected == 0 {
        logger.Warn("No rows updated, user not found", "userID", userID)
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    // Успешный ответ
    logger.Info("Password reset successful for user", "userID", userID)
    c.JSON(http.StatusOK, gin.H{
        "success": true,
        "message": "Password reset successful",
    })
}

func PasswordResetRedirect(c *gin.Context) {
    token := c.Query("token")
    if token == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or missing token"})
        return
    }

    // Формируем deep link для приложения
    appLink := fmt.Sprintf("payawareapp://reset-password?token=%s", token)
    c.Redirect(http.StatusTemporaryRedirect, appLink)

    // // Генерация HTML-страницы с кастомной схемой
    // htmlContent := fmt.Sprintf(`
    //     <!DOCTYPE html>
    //     <html lang="ru">
    //     <head>
    //         <meta charset="UTF-8">
    //         <meta name="viewport" content="width=device-width, initial-scale=1.0">
    //         <title>Сброс пароля</title>
    //     </head>
    //     <body>
    //         <p>Чтобы сбросить пароль, нажмите на ссылку ниже:</p>
    //         <a href="payawareapp://reset-password?token=%s">Сбросить пароль</a>
    //     </body>
    //     </html>
    // `, token)

    // c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlContent))
}