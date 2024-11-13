package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/handlers"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/SergeyMilch/pay_aware/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestCreateUser(t *testing.T) {
    // Настройка тестового окружения
    router := gin.Default()

    db.InitTestPostgres()
    db.GormDB.AutoMigrate(&models.User{})
    router.POST("/users", handlers.CreateUser)

    user := models.User{
        Email:    "john.doe@example.com",
        Password: "password123",
    }
    jsonValue, _ := json.Marshal(user)

    req, _ := http.NewRequest("POST", "/users", bytes.NewBuffer(jsonValue))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusCreated, w.Code)
    assert.Contains(t, w.Body.String(), "john.doe@example.com")
}

func TestGetUsers(t *testing.T) {
    // Настройка тестового окружения
    router := gin.Default()

    db.InitRedis()
    db.InitTestPostgres()
    db.GormDB.AutoMigrate(&models.User{})
    router.GET("/users", handlers.GetUsers)

    // Добавляем тестового пользователя
    user := models.User{
        Name:  "Jane Doe",
        Email: "jane.doe@example.com",
    }
    db.GormDB.Create(&user)

    req, _ := http.NewRequest("GET", "/users", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    assert.Contains(t, w.Body.String(), "jane.doe@example.com")
}

func TestUpdateDeviceToken(t *testing.T) {
    // Настройка тестового окружения
    router := gin.Default()

    db.InitRedis()
    db.InitTestPostgres()
    db.GormDB.AutoMigrate(&models.User{})
    router.PUT("/users/device-token", handlers.UpdateDeviceToken)

    // Добавляем тестового пользователя
    user := models.User{
        Name:  "John Doe",
        Email: "john.doe@example.com",
    }
    db.GormDB.Create(&user)

    // Создаем запрос на обновление токена устройства
    requestBody := map[string]interface{}{
        "user_id":      user.ID,
        "device_token": "new_device_token_12345",
    }
    jsonValue, _ := json.Marshal(requestBody)

    req, _ := http.NewRequest("PUT", "/users/device-token", bytes.NewBuffer(jsonValue))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    assert.Contains(t, w.Body.String(), "new_device_token_12345")
}

func TestLoginUser(t *testing.T) {
    // Настройка тестового окружения
    router := gin.Default()

    db.InitTestPostgres()
    db.GormDB.AutoMigrate(&models.User{})
    router.POST("/users/login", handlers.LoginUser)

    // Добавляем тестового пользователя с хешированным паролем
    hashedPassword, _ := utils.HashPassword("password123")
    user := models.User{
        Email:    "john.doe@example.com",
        Password: hashedPassword,
    }
    db.GormDB.Create(&user)

    // Создаем запрос на вход с корректными данными
    requestBody := map[string]interface{}{
        "email":    "john.doe@example.com",
        "password": "password123",
    }
    jsonValue, _ := json.Marshal(requestBody)

    req, _ := http.NewRequest("POST", "/users/login", bytes.NewBuffer(jsonValue))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    assert.Contains(t, w.Body.String(), "token")

    // Тестируем вход с неправильным паролем
    requestBody["password"] = "wrongpassword"
    jsonValue, _ = json.Marshal(requestBody)

    req, _ = http.NewRequest("POST", "/users/login", bytes.NewBuffer(jsonValue))
    req.Header.Set("Content-Type", "application/json")
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusUnauthorized, w.Code)
    assert.Contains(t, w.Body.String(), "Invalid email or password")

    // Тестируем вход с неправильным email
    requestBody["email"] = "wrong.email@example.com"
    requestBody["password"] = "password123"
    jsonValue, _ = json.Marshal(requestBody)

    req, _ = http.NewRequest("POST", "/users/login", bytes.NewBuffer(jsonValue))
    req.Header.Set("Content-Type", "application/json")
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusUnauthorized, w.Code)
    assert.Contains(t, w.Body.String(), "Invalid email or password")
}
