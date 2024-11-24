package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/SergeyMilch/pay_aware/internal/config"
	"github.com/SergeyMilch/pay_aware/internal/logger"
	"github.com/jackc/pgx/v5/pgxpool"
)

var PgxPool *pgxpool.Pool

// InitPgx инициализирует подключение к базе данных PostgreSQL с использованием pgx
func InitPgx(cfg *config.Config) {
    dsn := fmt.Sprintf(
        "postgres://%s:%s@%s:%s/%s?sslmode=%s",
        cfg.DBUser,
        cfg.DBPassword,
        cfg.DBHost,
        cfg.DBPort,
        cfg.DBName,
        cfg.DBSSLMode,
    )

    var err error
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    logger.Info("Attempting to connect to the database with pgx")

    PgxPool, err = pgxpool.New(ctx, dsn)
    if err != nil {
        logger.Error("Unable to create connection pool", "error", err)
        log.Fatalf("Unable to create connection pool: %v", err)
    }
}

// ClosePostgres закрывает пул соединений PostgreSQL
func ClosePostgres() {
    if PgxPool != nil {
        PgxPool.Close()
        log.Println("PostgreSQL connection pool closed")
    }
}