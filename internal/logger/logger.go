package logger

import (
	"io"
	"log/slog"
	"net"
	"os"

	"gopkg.in/natefinch/lumberjack.v2"
)

var Log *slog.Logger

func Init(env string) {
    var handler slog.Handler

    if env == "production" {
        logFile := &lumberjack.Logger{
            Filename:   "./production.log",
            MaxSize:    10, // Максимальный размер файла в MB
            MaxBackups: 3,  // Максимум 3 резервные копии
            MaxAge:     14, // Хранить 14 дней
        }

        // Подключаемся к Logstash
        var conn io.Writer
        logstashAddr := os.Getenv("LOGSTASH_ADDR")
        if logstashAddr != "" {
            c, err := net.Dial("tcp", logstashAddr)
            if err != nil {
                logFile.Write([]byte("WARN: Failed to connect to Logstash: " + err.Error() + "\n"))
            } else {
                conn = c
            }
        }

        // Используем MultiWriter для записи логов в файл и, при наличии, в Logstash
        if conn != nil {
            multiWriter := io.MultiWriter(logFile, conn)
            handler = slog.NewJSONHandler(multiWriter, &slog.HandlerOptions{Level: slog.LevelInfo})
        } else {
            handler = slog.NewJSONHandler(logFile, &slog.HandlerOptions{Level: slog.LevelInfo})
        }
    } else {
        handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
    }

    Log = slog.New(handler)
    slog.SetDefault(Log)
}


// Debug лог
func Debug(msg string, keysAndValues ...interface{}) {
    Log.Debug(msg, keysAndValues...)
}

// Info лог
func Info(msg string, keysAndValues ...interface{}) {
    Log.Info(msg, keysAndValues...)
}

// Warn лог
func Warn(msg string, keysAndValues ...interface{}) {
    Log.Warn(msg, keysAndValues...)
}

// Error лог
func Error(msg string, keysAndValues ...interface{}) {
    Log.Error(msg, keysAndValues...)
}
