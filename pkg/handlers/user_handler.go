package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/auth"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateUser создает нового пользователя и возвращает JWT токен
func CreateUser(c *gin.Context) {
    logger.Debug("Received request to create user")

    var user models.User
    if err := c.ShouldBindJSON(&user); err != nil {
        logger.Warn("Invalid user data provided", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user data"})
        return
    }

    // Проверка на уникальность email
    if !utils.IsValidEmail(user.Email) {
        logger.Warn("Invalid email format provided")
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format"})
        return
    }

    var existingUser models.User
    if err := db.GormDB.Where("email = ?", user.Email).First(&existingUser).Error; err == nil {
        logger.Warn("Attempt to create user with existing email")
        c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
        return
    }

    // Валидация пароля
    if user.Password == "" || !utils.IsValidPassword(user.Password) {
        logger.Warn("Invalid password provided")
        c.JSON(http.StatusBadRequest, gin.H{"error": "Password does not meet security requirements"})
        return
    }

    // Хэшируем пароль перед сохранением
    hashedPassword, err := utils.HashPassword(user.Password)
    if err != nil {
        logger.Error("Failed to hash password", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
        return
    }
    user.Password = hashedPassword

    // Используем транзакцию для создания пользователя
    err = db.GormDB.Transaction(func(tx *gorm.DB) error {
        if err := tx.Create(&user).Error; err != nil {
            logger.Error("Failed to create user", "error", err)
            return err
        }

        // Генерируем JWT токен для нового пользователя
        cfg := config.LoadConfig()
        token, err := auth.GenerateJWT(int(user.ID), cfg.JWTSecret, 7*24*time.Hour)
        if err != nil {
            logger.Error("Failed to generate JWT token", "userID", user.ID, "error", err)
            return err
        }

        // Возвращаем результат при успешном создании
        c.JSON(http.StatusCreated, gin.H{
            "message": "User created successfully, please set up your PIN code.",
            "token":   token,
            "user_id": user.ID,
        })
        return nil
    })

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
    } else {
        logger.Info("User created successfully", "userID", user.ID)
    }
}

// GetUsers возвращает список всех пользователей
func GetUsers(c *gin.Context) {
    ctx := context.Background()
    redisKey := "users_list"

    // Попытка получить данные из кэша
    cachedData, err := db.RedisClient.Get(ctx, redisKey).Result()
    if err == nil {
        logger.Debug("Cache hit for GetUsers")
        var users []models.User
        if err := json.Unmarshal([]byte(cachedData), &users); err == nil {
            c.JSON(http.StatusOK, users)
            return
        }
        logger.Warn("Failed to unmarshal cached users list", "error", err)
    } else {
        logger.Debug("Cache miss for GetUsers")
    }

    // Если кэш не найден, получаем данные из базы данных
    var users []models.User
    if err := db.GormDB.Select("id", "name").Find(&users).Error; err != nil {
        logger.Error("Failed to get users from DB", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
        return
    }

    // Кэшируем данные
    usersJSON, err := json.Marshal(users)
    if err != nil {
        logger.Warn("Failed to marshal users for caching", "error", err)
    } else {
        if err := db.RedisClient.Set(ctx, redisKey, usersJSON, time.Hour).Err(); err == nil {
            logger.Debug("Users list cached successfully")
        } else {
            logger.Warn("Failed to cache users list", "error", err)
        }
    }

    c.JSON(http.StatusOK, users)
}

// GetUserByID возвращает пользователя по ID
func GetUserByID(c *gin.Context) {
    // Извлечение userID из контекста
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    // Проверка типа userID
    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    // Получение пользователя из базы данных
    var user models.User
    if err := db.GormDB.Select("id", "name", "email").First(&user, userIDInt).Error; err != nil {
        logger.Info("User not found", "userID", userIDInt)
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    // Возвращаем нужные данные, включая email
    c.JSON(http.StatusOK, gin.H{
        "user_id": user.ID,
        "name":    user.Name,
        "email":   user.Email,
    })
}

// UpdateDeviceToken обновляет токен устройства пользователя
func UpdateDeviceToken(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    // Проверка типа userID
    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    logger.Debug("Received request to update device token", "userID", userIDInt)

    var request struct {
        DeviceToken string `json:"device_token"`
    }

    if err := c.ShouldBindJSON(&request); err != nil {
        logger.Warn("Invalid device token request", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if request.DeviceToken == "" {
        logger.Warn("Device token is empty", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Device token cannot be empty"})
        return
    }

    var user models.User
    if err := db.GormDB.First(&user, userIDInt).Error; err != nil {
        logger.Info("User not found for device token update", "userID", userIDInt)
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    user.DeviceToken = request.DeviceToken
    if err := db.GormDB.Save(&user).Error; err != nil {
        logger.Error("Failed to update device token", "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to update device token"})
        return
    }

    logger.Debug("Device token updated successfully", "userID", userIDInt)
    c.JSON(http.StatusOK, gin.H{"message": "Device token updated successfully"})
}

// LoginUser аутентифицирует пользователя и выдает JWT токен
func LoginUser(c *gin.Context) {
	logger.Debug("Received login request")

	var request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// Проверка корректности данных запроса
	if err := c.ShouldBindJSON(&request); err != nil {
		logger.Warn("Invalid login request data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Проверка формата email
	if !utils.IsValidEmail(request.Email) {
		logger.Warn("Invalid email format provided")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format"})
		return
	}

	// Найти пользователя по email
	var user models.User
	if err := db.GormDB.Where("email = ?", request.Email).First(&user).Error; err != nil {
		logger.Warn("Invalid login attempt - user not found")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Проверить пароль
	if !utils.CheckPasswordHash(request.Password, user.Password) {
		logger.Warn("Invalid login attempt - incorrect password")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Генерируем JWT токен
	cfg := config.LoadConfig()
	token, err := auth.GenerateJWT(int(user.ID), cfg.JWTSecret, 7*24*time.Hour)

	if err != nil {
		logger.Error("Failed to generate JWT token", "userID", user.ID, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	logger.Debug("User logged in successfully", "userID", user.ID)
	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"user_id": user.ID, // Добавляем user_id в ответ
	})
}

// SetPin для установки или изменения ПИН-кода
func SetPin(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    // Проверка типа userID
    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    logger.Debug("Received request to set PIN", "userID", userIDInt)

    var request struct {
        PinCode string `json:"pin_code"`
    }

    if err := c.ShouldBindJSON(&request); err != nil {
        logger.Warn("Invalid PIN code request", "error", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if len(request.PinCode) != 4 {
        logger.Warn("Invalid PIN code length", "userID", userIDInt)
        c.JSON(http.StatusBadRequest, gin.H{"error": "PIN code must be 4 digits"})
        return
    }

    // Хэшируем ПИН-код
    hashedPin, err := utils.HashPassword(request.PinCode)
    if err != nil {
        logger.Error("Failed to hash PIN code", "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set PIN code"})
        return
    }

    // Обновляем ПИН-код в базе данных
    if err := db.GormDB.Model(&models.User{}).Where("id = ?", userIDInt).Update("pin_code", hashedPin).Error; err != nil {
        logger.Error("Failed to update PIN code", "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to set PIN code"})
        return
    }

    logger.Debug("PIN code set successfully", "userID", userIDInt)
    c.JSON(http.StatusOK, gin.H{"message": "PIN code set successfully"})
}

// LoginWithPin для входа с ПИН-кодом
func LoginWithPin(c *gin.Context) {
    logger.Debug("Received login request with PIN")

    var request struct {
        UserID  int    `json:"user_id"`
        PinCode string `json:"pin_code"`
    }

    if err := c.ShouldBindJSON(&request); err != nil {
        logger.Warn("Invalid login request with PIN data", "error", err)
        logger.Debug("request", "request", request)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    // Найти пользователя по ID
    var user models.User
    if err := db.GormDB.First(&user, request.UserID).Error; err != nil {
        logger.Warn("Invalid login attempt - user not found", "user_id", request.UserID)
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID or PIN"})
        return
    }

    // Проверить ПИН-код
    if !utils.CheckPasswordHash(request.PinCode, user.PinCode) {
        logger.Warn("Invalid login attempt - incorrect PIN", "user_id", request.UserID)
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID or PIN"})
        return
    }

    // Генерируем JWT токен
    cfg := config.LoadConfig()
    token, err := auth.GenerateJWT(int(user.ID), cfg.JWTSecret, 7*24*time.Hour)
    if err != nil {
        logger.Error("Failed to generate JWT token", "userID", user.ID, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
        return
    }

    logger.Debug("User logged in successfully with PIN", "userID", user.ID)
    c.JSON(http.StatusOK, gin.H{
        "token":   token,
        "user_id": user.ID,
    })
}

// LogoutUser сбрасывает device_token у пользователя, чтобы пуши не приходили
func LogoutUser(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        logger.Warn("User ID is missing in context")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
        return
    }

    userIDInt, ok := userID.(int)
    if !ok {
        logger.Error("Invalid user ID type in context")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    // Ищем пользователя по userIDInt
    var user models.User
    if err := db.GormDB.First(&user, userIDInt).Error; err != nil {
        logger.Warn("User not found during logout", "userID", userIDInt)
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    // Обнуляем DeviceToken
    user.DeviceToken = ""
    if err := db.GormDB.Save(&user).Error; err != nil {
        logger.Error("Failed to logout (clear device token)", "userID", userIDInt, "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to logout"})
        return
    }

    // Дополнительно, если нужно - можно добавить принудительное истечение JWT-токена,
    // но у вас это, скорее всего, просто на клиенте удалится.

    c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

// DeleteUserAccount удаляет аккаунт пользователя и связанные записи
func DeleteUserAccount(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		logger.Warn("User ID is missing in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userIDInt, ok := userID.(int)
	if !ok {
		logger.Error("Invalid user ID type in context")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Начало транзакции
	tx := db.GormDB.Begin()
	if tx.Error != nil {
		logger.Error("Failed to begin transaction", "error", tx.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Удаление пользователя
	if err := tx.Delete(&models.User{}, userIDInt).Error; err != nil {
		logger.Error("Failed to delete user account", "userID", userIDInt, "error", err)
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to delete user account"})
		return
	}

	// Физическое удаление записей (Unscoped) для каскадного удаления подписок и уведомлений
	// Поскольку soft delete не триггерит ON DELETE CASCADE
	if err := tx.Unscoped().Where("user_id = ?", userIDInt).Delete(&models.Subscription{}).Error; err != nil {
		logger.Error("Failed to delete user subscriptions", "userID", userIDInt, "error", err)
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to delete user subscriptions"})
		return
	}

	// Коммит транзакции
	if err := tx.Commit().Error; err != nil {
		logger.Error("Failed to commit transaction", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User account and related subscriptions deleted successfully"})
}