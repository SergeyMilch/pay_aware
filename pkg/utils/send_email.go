package utils

import (
	"os"

	"gopkg.in/gomail.v2"
)

func SendEmail(to, subject, body string) error {
    m := gomail.NewMessage()
    m.SetHeader("From", os.Getenv("SMTP_FROM"))
    m.SetHeader("To", to)
    m.SetHeader("Subject", subject)
    m.SetBody("text/html", body)

    d := gomail.NewDialer(os.Getenv("SMTP_HOST"), 587, os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASS"))
    return d.DialAndSend(m)
}