package handlers_test

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/SergeyMilch/pay_aware/pkg/db"
	"github.com/SergeyMilch/pay_aware/pkg/handlers"
	"github.com/SergeyMilch/pay_aware/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// InitMockDB инициализирует базу данных в памяти для тестирования
func InitMockDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal("Failed to initialize mock database", err)
	}

	db.AutoMigrate(&models.User{}, &models.Subscription{})
	return db
}

// ClearMockDB очищает все таблицы базы данных для тестирования
func ClearMockDB(t *testing.T, db *gorm.DB) {
	err := db.Migrator().DropTable(&models.User{}, &models.Subscription{})
	if err != nil {
		t.Fatal("Failed to clear mock database:", err)
	}
	db.AutoMigrate(&models.User{}, &models.Subscription{})
}

// TestMain выполняет начальную настройку
func TestMain(m *testing.M) {
	logger.Init("")

	envPath, _ := filepath.Abs("/path/to/.env")
	if err := godotenv.Load(envPath); err != nil {
		log.Println("Warning: no .env file found at", envPath)
	}

	db.InitRedis()
	db.GormDB = InitMockDB(nil)
	os.Exit(m.Run())
}

func TestCreateSubscription(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db.GormDB = InitMockDB(t)
	ClearMockDB(t, db.GormDB)

	router := gin.Default()
	router.POST("/subscription", handlers.CreateSubscription)

	nextPaymentDate := time.Now().AddDate(0, 1, 0)
	newSubscription := models.Subscription{
		UserID:          1,
		ServiceName:     "Test Service",
		Cost:            100.0,
		NextPaymentDate: nextPaymentDate,
	}
	body, _ := json.Marshal(newSubscription)
	req, err := http.NewRequest(http.MethodPost, "/subscription", bytes.NewBuffer(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var createdSubscription models.Subscription
	err = json.Unmarshal(rr.Body.Bytes(), &createdSubscription)
	assert.NoError(t, err)
	assert.Equal(t, "Test Service", createdSubscription.ServiceName)
	assert.Equal(t, 100.0, createdSubscription.Cost)
}

func TestCreateSubscriptionWithRecurrence(t *testing.T) {
    gin.SetMode(gin.TestMode)
    db.GormDB = InitMockDB(t)
    ClearMockDB(t, db.GormDB)

    router := gin.Default()
    router.POST("/subscription", handlers.CreateSubscription)

    nextPaymentDate := time.Now().AddDate(0, 1, 0)
    newSubscription := models.Subscription{
        UserID:          1,                  // Обычно ID берётся из токена, но в тесте – напрямую
        ServiceName:     "Test Monthly Service",
        Cost:            50.0,
        NextPaymentDate: nextPaymentDate,
        RecurrenceType:  "monthly",          // <-- Вот ключевой момент!
    }
    body, _ := json.Marshal(newSubscription)
    req, err := http.NewRequest(http.MethodPost, "/subscription", bytes.NewBuffer(body))
    assert.NoError(t, err)
    req.Header.Set("Content-Type", "application/json")

    rr := httptest.NewRecorder()
    router.ServeHTTP(rr, req)
    assert.Equal(t, http.StatusOK, rr.Code)

    var createdSubscription models.Subscription
    err = json.Unmarshal(rr.Body.Bytes(), &createdSubscription)
    assert.NoError(t, err)
    assert.Equal(t, "Test Monthly Service", createdSubscription.ServiceName)
    assert.Equal(t, 50.0, createdSubscription.Cost)
    assert.Equal(t, "monthly", createdSubscription.RecurrenceType) // <-- проверяем поле
}

func TestCreateSubscriptionMissingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db.GormDB = InitMockDB(t)
	ClearMockDB(t, db.GormDB)

	router := gin.Default()
	router.POST("/subscription", handlers.CreateSubscription)

	newSubscription := models.Subscription{ServiceName: "Test Service"}
	body, _ := json.Marshal(newSubscription)
	req, err := http.NewRequest(http.MethodPost, "/subscription", bytes.NewBuffer(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestGetSubscriptions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db.GormDB = InitMockDB(t)
	ClearMockDB(t, db.GormDB)

	// Добавляем тестовые подписки
	nextPaymentDate1, _ := time.Parse("2006-01-02", "2024-11-01")
	nextPaymentDate2, _ := time.Parse("2006-01-02", "2024-12-01")

	subscriptions := []models.Subscription{
		{UserID: 1, ServiceName: "Netflix", Cost: 9.99, NextPaymentDate: nextPaymentDate1},
		{UserID: 1, ServiceName: "Spotify", Cost: 4.99, NextPaymentDate: nextPaymentDate2},
	}
	for _, sub := range subscriptions {
		db.GormDB.Create(&sub)
	}

	req, err := http.NewRequest(http.MethodGet, "/subscriptions", nil)
	assert.NoError(t, err)

	rr := httptest.NewRecorder()
	router := gin.Default()
	router.GET("/subscriptions", handlers.GetSubscriptions)
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var receivedSubscriptions []models.Subscription
	err = json.Unmarshal(rr.Body.Bytes(), &receivedSubscriptions)
	assert.NoError(t, err)
	assert.Len(t, receivedSubscriptions, 2)
	assert.Equal(t, "Netflix", receivedSubscriptions[0].ServiceName)
	assert.Equal(t, "Spotify", receivedSubscriptions[1].ServiceName)
}

func TestUpdateSubscription(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db.GormDB = InitMockDB(t)
	ClearMockDB(t, db.GormDB)

	// Добавляем тестовую подписку
	nextPaymentDate, _ := time.Parse("2006-01-02", "2024-11-02")
	subscription := models.Subscription{
		UserID:          1,
		ServiceName:     "Spotify",
		Cost:            4.99,
		NextPaymentDate: nextPaymentDate,
	}
	db.GormDB.Create(&subscription)

	// Обновленный запрос
	updatedNextPaymentDate, _ := time.Parse("2006-01-02", "2024-12-02")
	updatedSubscription := models.Subscription{
		ServiceName:     "Spotify Premium",
		Cost:            9.99,
		NextPaymentDate: updatedNextPaymentDate,
	}
	body, _ := json.Marshal(updatedSubscription)
	req, err := http.NewRequest(http.MethodPut, "/subscription/"+strconv.Itoa(int(subscription.ID)), bytes.NewBuffer(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router := gin.Default()
	router.PUT("/subscription/:id", handlers.UpdateSubscription)
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var updated models.Subscription
	db.GormDB.First(&updated, subscription.ID)
	assert.Equal(t, "Spotify Premium", updated.ServiceName)
	assert.Equal(t, 9.99, updated.Cost)
	assert.True(t, updatedNextPaymentDate.Equal(updated.NextPaymentDate), "NextPaymentDate does not match")
}

func TestUpdateSubscriptionRecurrence(t *testing.T) {
    gin.SetMode(gin.TestMode)
    db.GormDB = InitMockDB(t)
    ClearMockDB(t, db.GormDB)

    // 1) Сначала создадим подписку без RecurrenceType
    subscription := models.Subscription{
        UserID:          1,
        ServiceName:     "HBO",
        Cost:            9.99,
        NextPaymentDate: time.Now().AddDate(0, 0, 10),
        RecurrenceType:  "", // пустое
    }
    db.GormDB.Create(&subscription)

    // 2) Обновим подписку, проставив "yearly"
    updatedSubscription := models.Subscription{
        ServiceName:     "HBO Max",
        Cost:            14.99,
        NextPaymentDate: time.Now().AddDate(0, 0, 20),
        RecurrenceType:  "yearly",
    }
    body, _ := json.Marshal(updatedSubscription)
    req, err := http.NewRequest(
        http.MethodPut,
        "/subscription/"+strconv.Itoa(int(subscription.ID)),
        bytes.NewBuffer(body),
    )
    assert.NoError(t, err)
    req.Header.Set("Content-Type", "application/json")

    rr := httptest.NewRecorder()
    router := gin.Default()
    router.PUT("/subscription/:id", handlers.UpdateSubscription)
    router.ServeHTTP(rr, req)

    assert.Equal(t, http.StatusOK, rr.Code)

    // Проверяем в базе, что реально обновилось
    var updated models.Subscription
    err = db.GormDB.First(&updated, subscription.ID).Error
    assert.NoError(t, err)
    assert.Equal(t, "HBO Max", updated.ServiceName)
    assert.Equal(t, 14.99, updated.Cost)
    assert.Equal(t, "yearly", updated.RecurrenceType) // <-- проверяем поле
}

func TestDeleteSubscription(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db.GormDB = InitMockDB(t)
	ClearMockDB(t, db.GormDB)

	// Добавляем тестовую подписку
	nextPaymentDate, _ := time.Parse("2006-01-02", "2024-11-01")
	subscription := models.Subscription{
		UserID:          1,
		ServiceName:     "Netflix",
		Cost:            9.99,
		NextPaymentDate: nextPaymentDate,
	}
	db.GormDB.Create(&subscription)

	req, err := http.NewRequest(http.MethodDelete, "/subscription/"+strconv.Itoa(int(subscription.ID)), nil)
	assert.NoError(t, err)

	rr := httptest.NewRecorder()
	router := gin.Default()
	router.DELETE("/subscription/:id", handlers.DeleteSubscription)
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var deleted models.Subscription
	err = db.GormDB.First(&deleted, subscription.ID).Error
	assert.Error(t, err)
	assert.Equal(t, gorm.ErrRecordNotFound, err)
}

// func TestGetTotalCost(t *testing.T) {
// 	// Инициализируем Gin в режиме тестирования
// 	gin.SetMode(gin.TestMode)

// 	// Мокаем базу данных
// 	db.GormDB = InitMockDB(t)
// 	ClearMockDB(t, db.GormDB)

// 	// Добавляем тестовые подписки
// 	nextPaymentDate1, _ := time.Parse("2006-01-02", "2024-11-01")
// 	nextPaymentDate2, _ := time.Parse("2006-01-02", "2024-12-01")
// 	subscriptions := []models.Subscription{
// 		{UserID: 1, ServiceName: "Netflix", Cost: 9.99, NextPaymentDate: nextPaymentDate1},
// 		{UserID: 1, ServiceName: "Spotify", Cost: 4.99, NextPaymentDate: nextPaymentDate2},
// 	}
// 	for _, sub := range subscriptions {
// 		db.GormDB.Create(&sub)
// 	}

// 	// Создаем запрос на получение общей стоимости подписок
// 	req, err := http.NewRequest(http.MethodGet, "/total-cost", nil)
// 	assert.NoError(t, err)

// 	// Создаем ResponseRecorder для захвата ответа
// 	rr := httptest.NewRecorder()

// 	router := gin.Default()
// 	router.GET("/total-cost", handlers.GetTotalCost)

// 	// Выполняем запрос
// 	router.ServeHTTP(rr, req)

// 	// Проверяем статус ответа
// 	assert.Equal(t, http.StatusOK, rr.Code)

// 	// Проверяем, что общая стоимость верна
// 	var response map[string]float64
// 	err = json.Unmarshal(rr.Body.Bytes(), &response)
// 	assert.NoError(t, err)
// 	totalCost, exists := response["total_cost"]
// 	assert.True(t, exists)
// 	assert.Equal(t, 14.98, totalCost)
// }
