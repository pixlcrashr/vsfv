package passwordhash

import (
	"errors"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
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
}

func TestHashFormat(t *testing.T) {
	hash, err := Hash("x")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	if !strings.HasPrefix(hash, "argon2id:$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Errorf("hash has unexpected format: %s", hash)
	}
}

func TestHashUniqueSalts(t *testing.T) {
	a, err := Hash("same-password")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	b, err := Hash("same-password")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	if a == b {
		t.Error("two hashes of the same password are equal; salts are not random")
	}
}

func TestVerifyLegacyBcrypt(t *testing.T) {
	bare, err := bcrypt.GenerateFromPassword([]byte("legacy-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("GenerateFromPassword: %v", err)
	}
	legacy := string(bare)

	if err := Verify(legacy, "legacy-password"); err != nil {
		t.Errorf("Verify legacy bcrypt: %v", err)
	}
	if err := Verify(legacy, "wrong"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("Verify legacy bcrypt wrong password: got %v, want ErrWrongPassword", err)
	}
	if !NeedsRehash(legacy) {
		t.Error("NeedsRehash should be true for bare bcrypt hashes")
	}
}

func TestNeedsRehash(t *testing.T) {
	hash, err := Hash("x")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if NeedsRehash(hash) {
		t.Error("NeedsRehash should be false for current-format hashes")
	}
	if NeedsRehash("") {
		t.Error("NeedsRehash should be false for empty strings")
	}
}

func TestVerifyUnknownFormat(t *testing.T) {
	for _, stored := range []string{"", "garbage", "foo:$foo$v=1$x$y", "md5:abcdef"} {
		if err := Verify(stored, "x"); !errors.Is(err, ErrUnknownHashFormat) {
			t.Errorf("Verify(%q): got %v, want ErrUnknownHashFormat", stored, err)
		}
	}
}

func TestVerifyTamperedHash(t *testing.T) {
	hash, err := Hash("s3cret-password")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	// Flip the last character of the encoded key.
	tampered := hash[:len(hash)-1]
	if hash[len(hash)-1] == 'A' {
		tampered += "B"
	} else {
		tampered += "A"
	}

	if err := Verify(tampered, "s3cret-password"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("Verify tampered hash: got %v, want ErrWrongPassword", err)
	}
}
