// Package passwordhash implements password hashing and verification for the
// users.password_hash column. Hashes are stored in the
// "<hash-name>:<hash>" format, e.g.
// "argon2id:$argon2id$v=19$m=19456,t=2,p=1$<salt>$<key>", so future
// algorithms can replace argon2id without a schema migration.
package passwordhash

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Hashing parameters follow the OWASP Password Storage Cheat Sheet
// recommendation for argon2id (19 MiB memory, 2 iterations, 1 thread).
const (
	argon2IDHashName = "argon2id"
	argon2IDMemory   = 19456 // KiB
	argon2IDTime     = 2
	argon2IDThreads  = 1
	argon2IDKeyLen   = 32
	argon2IDSaltLen  = 16
)

const hashSeparator = ":"

var phcBase64 = base64.RawStdEncoding

var (
	// ErrWrongPassword is returned when the password does not match the
	// stored hash.
	ErrWrongPassword = errors.New("password does not match stored hash")
	// ErrUnknownHashFormat is returned when the stored hash cannot be
	// interpreted. This indicates corrupt data or an unsupported
	// algorithm, not a wrong password.
	ErrUnknownHashFormat = errors.New("unknown password hash format")
)

// Hash hashes password with argon2id and returns it in the
// "<hash-name>:<hash>" storage format.
func Hash(password string) (string, error) {
	salt := make([]byte, argon2IDSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generating salt: %w", err)
	}

	key := argon2.IDKey([]byte(password), salt, argon2IDTime, argon2IDMemory, argon2IDThreads, argon2IDKeyLen)

	return fmt.Sprintf("%s%s$%s$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2IDHashName, hashSeparator, argon2IDHashName, argon2.Version,
		argon2IDMemory, argon2IDTime, argon2IDThreads,
		phcBase64.EncodeToString(salt), phcBase64.EncodeToString(key),
	), nil
}

// Verify checks password against the stored "<hash-name>:<hash>" value.
// Bare bcrypt hashes without an algorithm prefix (created by earlier
// versions of the adduser CLI) are still accepted as a legacy fallback; use
// NeedsRehash to detect them for transparent upgrades.
func Verify(stored, password string) error {
	name, encoded, found := strings.Cut(stored, hashSeparator)
	if !found {
		if isBcryptHash(stored) {
			if err := bcrypt.CompareHashAndPassword([]byte(stored), []byte(password)); err != nil {
				return ErrWrongPassword
			}
			return nil
		}
		return ErrUnknownHashFormat
	}

	if name != argon2IDHashName {
		return fmt.Errorf("%w: %q", ErrUnknownHashFormat, name)
	}
	return verifyArgon2ID(encoded, password)
}

// NeedsRehash reports whether the stored hash uses a legacy format that
// should be upgraded to the current format after a successful verification.
func NeedsRehash(stored string) bool {
	if _, _, found := strings.Cut(stored, hashSeparator); !found {
		return isBcryptHash(stored)
	}
	return false
}

func verifyArgon2ID(encoded, password string) error {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != argon2IDHashName {
		return ErrUnknownHashFormat
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return fmt.Errorf("%w: parsing version: %v", ErrUnknownHashFormat, err)
	}
	if version != argon2.Version {
		return fmt.Errorf("%w: unsupported argon2 version %d", ErrUnknownHashFormat, version)
	}

	var memory, time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return fmt.Errorf("%w: parsing parameters: %v", ErrUnknownHashFormat, err)
	}

	salt, err := phcBase64.DecodeString(parts[4])
	if err != nil {
		return fmt.Errorf("%w: decoding salt: %v", ErrUnknownHashFormat, err)
	}
	key, err := phcBase64.DecodeString(parts[5])
	if err != nil {
		return fmt.Errorf("%w: decoding key: %v", ErrUnknownHashFormat, err)
	}

	computed := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(key)))
	if subtle.ConstantTimeCompare(computed, key) != 1 {
		return ErrWrongPassword
	}
	return nil
}

func isBcryptHash(s string) bool {
	return strings.HasPrefix(s, "$2a$") || strings.HasPrefix(s, "$2b$") || strings.HasPrefix(s, "$2y$")
}
