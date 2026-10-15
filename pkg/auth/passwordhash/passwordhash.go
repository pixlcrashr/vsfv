// Package passwordhash implements password hashing and verification for the
// users.password_hash column. Hashing and verification are delegated to
// github.com/theater-improrama/go-utils/password, which provides multiple
// algorithms (argon2id, pbkdf2-sha512); argon2id is the default for new
// hashes. Hashes are stored in the "<algorithm>:<hash>" format, e.g.
// "argon2id:<base64-encoded JSON payload>", so algorithms can be replaced
// without a schema migration.
package passwordhash

import (
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/theater-improrama/go-utils/password"
	"github.com/theater-improrama/go-utils/password/argon2id"
	"github.com/theater-improrama/go-utils/password/pbkdf2"
	"golang.org/x/crypto/argon2"
)

// Hashing parameters follow the OWASP Password Storage Cheat Sheet
// recommendation for argon2id (19 MiB memory, 2 iterations, 1 thread).
const (
	argon2IDMemory  = 19456 // KiB
	argon2IDTime    = 2
	argon2IDThreads = 1
	argon2IDKeyLen  = 32
)

const (
	saltLength    = 16
	hashSeparator = ":"
)

var saltGenerator = password.NewDefaultSaltGenerator(saltLength)

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

// Hash hashes plaintext with argon2id, the default algorithm, and returns it
// in the "<algorithm>:<hash>" storage format.
func Hash(plaintext string) (string, error) {
	return hashWith(argon2id.Provide(saltGenerator, argon2id.Params{
		Time:    argon2IDTime,
		Memory:  argon2IDMemory,
		Threads: argon2IDThreads,
		KeyLen:  argon2IDKeyLen,
	}), plaintext)
}

// Verify checks plaintext against the stored "<algorithm>:<hash>" value.
// PHC-style argon2id hashes written by earlier versions of the server are
// still accepted as a legacy fallback; use NeedsRehash to detect them for
// transparent upgrades.
func Verify(stored, plaintext string) error {
	name, encoded, found := strings.Cut(stored, hashSeparator)
	if !found {
		return ErrUnknownHashFormat
	}

	switch name {
	case argon2id.Type:
		if strings.HasPrefix(encoded, "$") {
			// PHC-style argon2id hash written by earlier versions.
			return verifyLegacyArgon2ID(encoded, plaintext)
		}

		key, salt, params, err := argon2id.Decode(encoded)
		if err != nil {
			return fmt.Errorf("%w: decoding argon2id hash: %v", ErrUnknownHashFormat, err)
		}
		if err := checkArgon2IDParams(params); err != nil {
			return err
		}
		return validate(argon2id.New(salt, params), key, plaintext)

	case pbkdf2.TypeSha512:
		key, salt, params, err := pbkdf2.Decode(encoded)
		if err != nil {
			return fmt.Errorf("%w: decoding pbkdf2-sha512 hash: %v", ErrUnknownHashFormat, err)
		}
		if params.Iter < 1 || params.KeyLen < 1 {
			return fmt.Errorf("%w: invalid pbkdf2-sha512 parameters", ErrUnknownHashFormat)
		}
		return validate(pbkdf2.NewSha512(salt, params), key, plaintext)

	default:
		return fmt.Errorf("%w: %q", ErrUnknownHashFormat, name)
	}
}

// NeedsRehash reports whether the stored hash uses a legacy format that
// should be upgraded to the current format after a successful verification.
func NeedsRehash(stored string) bool {
	name, encoded, found := strings.Cut(stored, hashSeparator)
	if !found {
		return false
	}
	// PHC-style argon2id hashes written by earlier versions.
	return name == argon2id.Type && strings.HasPrefix(encoded, "$")
}

func hashWith(provide password.ProviderFn, plaintext string) (string, error) {
	provider, err := provide()
	if err != nil {
		return "", fmt.Errorf("creating hash provider: %w", err)
	}

	encoded, err := provider.HashEncode([]byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("hashing password: %w", err)
	}

	return provider.Type() + hashSeparator + encoded, nil
}

// validate reports ErrWrongPassword unless provider validates key against
// plaintext.
func validate(provider password.Provider, key []byte, plaintext string) error {
	ok, err := provider.Validate(key, []byte(plaintext))
	if err != nil {
		return fmt.Errorf("validating password: %w", err)
	}
	if !ok {
		return ErrWrongPassword
	}
	return nil
}

// checkArgon2IDParams rejects degenerate parameters. x/crypto/argon2 panics
// on time < 1 or threads < 1, and an empty derivative would validate any
// password, so corrupt stored hashes must not reach it.
func checkArgon2IDParams(p argon2id.Params) error {
	if p.Time < 1 || p.Threads < 1 || p.KeyLen < 16 {
		return fmt.Errorf("%w: invalid argon2id parameters", ErrUnknownHashFormat)
	}
	return nil
}

func verifyLegacyArgon2ID(encoded, plaintext string) error {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != argon2id.Type {
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
	if err := checkArgon2IDParams(argon2id.Params{Time: time, Threads: threads, KeyLen: uint32(len(key))}); err != nil {
		return err
	}

	computed := argon2.IDKey([]byte(plaintext), salt, time, memory, threads, uint32(len(key)))
	if subtle.ConstantTimeCompare(computed, key) != 1 {
		return ErrWrongPassword
	}
	return nil
}
