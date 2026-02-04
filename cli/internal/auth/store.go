// Package auth handles authentication token storage
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Credentials stores authentication information
type Credentials struct {
	Token     string    `json:"token"`
	Server    string    `json:"server"`
	Username  string    `json:"username,omitempty"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
}

// Store manages credential storage
type Store struct {
	filePath string
}

// NewStore creates a new credential store
func NewStore() (*Store, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot find home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".minicluster")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, fmt.Errorf("cannot create config directory: %w", err)
	}

	return &Store{
		filePath: filepath.Join(configDir, "credentials"),
	}, nil
}

// Save stores credentials for a server
func (s *Store) Save(creds *Credentials) error {
	// Load existing credentials
	allCreds, _ := s.loadAll()
	if allCreds == nil {
		allCreds = make(map[string]*Credentials)
	}

	// Store by server
	allCreds[creds.Server] = creds

	// Write to file
	data, err := json.MarshalIndent(allCreds, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal credentials: %w", err)
	}

	if err := os.WriteFile(s.filePath, data, 0600); err != nil {
		return fmt.Errorf("failed to write credentials: %w", err)
	}

	return nil
}

// Load retrieves credentials for a server
func (s *Store) Load(server string) (*Credentials, error) {
	allCreds, err := s.loadAll()
	if err != nil {
		return nil, err
	}

	creds, exists := allCreds[server]
	if !exists {
		return nil, fmt.Errorf("no credentials found for %s", server)
	}

	// Check expiration
	if !creds.ExpiresAt.IsZero() && creds.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("credentials expired for %s", server)
	}

	return creds, nil
}

// Delete removes credentials for a server
func (s *Store) Delete(server string) error {
	allCreds, err := s.loadAll()
	if err != nil {
		// If file doesn't exist, nothing to delete
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	delete(allCreds, server)

	// Write back
	data, err := json.MarshalIndent(allCreds, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal credentials: %w", err)
	}

	return os.WriteFile(s.filePath, data, 0600)
}

// List returns all stored server credentials
func (s *Store) List() (map[string]*Credentials, error) {
	return s.loadAll()
}

// loadAll reads all credentials from file
func (s *Store) loadAll() (map[string]*Credentials, error) {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}

	var allCreds map[string]*Credentials
	if err := json.Unmarshal(data, &allCreds); err != nil {
		return nil, fmt.Errorf("failed to parse credentials: %w", err)
	}

	return allCreds, nil
}

// HasCredentials checks if any credentials exist
func (s *Store) HasCredentials() bool {
	_, err := os.Stat(s.filePath)
	return err == nil
}

// GetToken is a convenience function to get the token for a server
func (s *Store) GetToken(server string) (string, error) {
	creds, err := s.Load(server)
	if err != nil {
		return "", err
	}
	return creds.Token, nil
}
