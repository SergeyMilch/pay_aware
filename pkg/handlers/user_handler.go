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
        token, err := auth.GenerateJWT(int(user.ID), cfg.JWTSecret)
        if err != nil {
            logger.Error("Failed to generate JWT token", "userID", user.ID, "error", err)
            return err
        }

        // Возвращаем результат при успешном создании
        c.JSON(http.StatusCreated, gin.H{
            "message": "User created successfully",
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
	token, err := auth.GenerateJWT(int(user.ID), cfg.JWTSecret)
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
