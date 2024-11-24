package utils

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
)

// CreateTLSConfiguration создает TLS конфигурацию для использования с Kafka
func CreateTLSConfiguration(truststorePath, truststorePassword string) (*tls.Config, error) {
	certPool := x509.NewCertPool()
	truststore, err := os.ReadFile(truststorePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read truststore file: %v", err)
	}

	if ok := certPool.AppendCertsFromPEM(truststore); !ok {
		return nil, fmt.Errorf("failed to add truststore certificates")
	}

	return &tls.Config{
		RootCAs: certPool,
	}, nil
}
