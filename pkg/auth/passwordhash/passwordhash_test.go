package passwordhash

import (
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/theater-improrama/go-utils/password"
	"github.com/theater-improrama/go-utils/password/argon2id"
	"github.com/theater-improrama/go-utils/password/pbkdf2"
	"golang.org/x/crypto/argon2"
)

func TestHashVerifyRoundTrip(t *testing.T) {
	hash, err := Hash("s3cret-password")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	if err := Verify(hash, "s3cret-password"); err != nil {
		t.Errorf("Verify with correct password: %v", err)
	}
	if err := Verify(hash, "wrong-password"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("Verify with wrong password: got %v, want ErrWrongPassword", err)
	}
	if NeedsRehash(hash) {
		t.Error("NeedsRehash should be false for current-format hashes")
	}
}

func TestHashFormat(t *testing.T) {
	hash, err := Hash("x")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	encoded, found := strings.CutPrefix(hash, argon2id.Type+":")
	if !found {
		t.Fatalf("hash has unexpected format: %s", hash)
	}

	_, salt, params, err := argon2id.Decode(encoded)
	if err != nil {
		t.Fatalf("decoding hash: %v", err)
	}
	if len(salt) != saltLength {
		t.Errorf("hash salt has unexpected length: got %d, want %d", len(salt), saltLength)
	}
	if params != (argon2id.Params{Time: 2, Memory: 19456, Threads: 1, KeyLen: 32}) {
		t.Errorf("hash has unexpected parameters: %+v", params)
	}
}

// legacyPHCHash builds a hash in the PHC-style format written by the
// previous implementation ("argon2id:$argon2id$v=19$...").
func legacyPHCHash(t *testing.T, plaintext string) string {
	t.Helper()

	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		t.Fatalf("reading salt: %v", err)
	}
	key := argon2.IDKey([]byte(plaintext), salt, argon2IDTime, argon2IDMemory, argon2IDThreads, argon2IDKeyLen)

	return fmt.Sprintf("%s%s$%s$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2id.Type, hashSeparator, argon2id.Type, argon2.Version,
		argon2IDMemory, argon2IDTime, argon2IDThreads,
		phcBase64.EncodeToString(salt), phcBase64.EncodeToString(key),
	)
}

func TestVerifyLegacyPHCArgon2ID(t *testing.T) {
	legacy := legacyPHCHash(t, "legacy-password")

	if err := Verify(legacy, "legacy-password"); err != nil {
		t.Errorf("Verify legacy PHC argon2id: %v", err)
	}
	if err := Verify(legacy, "wrong"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("Verify legacy PHC argon2id wrong password: got %v, want ErrWrongPassword", err)
	}
	if !NeedsRehash(legacy) {
		t.Error("NeedsRehash should be true for legacy PHC argon2id hashes")
	}
}

func TestVerifyPBKDF2Sha512(t *testing.T) {
	provider, err := pbkdf2.Provide(
		password.NewDefaultSaltGenerator(saltLength),
		pbkdf2.Params{KeyLen: 64, Iter: 1000},
	)()
	if err != nil {
		t.Fatalf("providing pbkdf2 provider: %v", err)
	}

	encoded, err := provider.HashEncode([]byte("s3cret-password"))
	if err != nil {
		t.Fatalf("HashEncode: %v", err)
	}
	stored := provider.Type() + hashSeparator + encoded

	if err := Verify(stored, "s3cret-password"); err != nil {
		t.Errorf("Verify pbkdf2-sha512: %v", err)
	}
	if err := Verify(stored, "wrong-password"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("Verify pbkdf2-sha512 wrong password: got %v, want ErrWrongPassword", err)
	}
	if NeedsRehash(stored) {
		t.Error("NeedsRehash should be false for pbkdf2-sha512 hashes")
	}
}

func TestVerifyUnknownFormat(t *testing.T) {
	for _, stored := range []string{
		"",
		"garbage",
		"foo:$foo$v=1$x$y",
		"md5:abcdef",
		"argon2id:garbage",
	} {
		if err := Verify(stored, "x"); !errors.Is(err, ErrUnknownHashFormat) {
			t.Errorf("Verify(%q): got %v, want ErrUnknownHashFormat", stored, err)
		}
	}
}

func TestVerifyDegenerateParams(t *testing.T) {
	// x/crypto/argon2 panics on time < 1; a zero-length key would validate
	// any password. Either way the hash must be rejected as unknown format.
	for _, params := range []argon2id.Params{
		{Time: 0, Memory: 19456, Threads: 1, KeyLen: 32},
		{Time: 2, Memory: 19456, Threads: 0, KeyLen: 32},
		{Time: 2, Memory: 19456, Threads: 1, KeyLen: 0},
	} {
		encoded, err := argon2id.Encode(make([]byte, 32), make([]byte, saltLength), params)
		if err != nil {
			t.Fatalf("Encode: %v", err)
		}
		stored := argon2id.Type + hashSeparator + encoded

		if err := Verify(stored, "x"); !errors.Is(err, ErrUnknownHashFormat) {
			t.Errorf("Verify(%+v): got %v, want ErrUnknownHashFormat", params, err)
		}
	}
}
