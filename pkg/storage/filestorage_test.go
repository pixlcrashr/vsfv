package storage

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestFileStoragePath(t *testing.T) {
	s, err := NewFileStorage(filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatalf("NewFileStorage: %v", err)
	}

	id := uuid.MustParse("00ab12cd-34ef-4567-89ab-cdef01234567")
	want := filepath.Join(s.DataPath(), "00", "00ab12cd-34ef-4567-89ab-cdef01234567")
	if got := s.Path(id); got != want {
		t.Errorf("Path() = %q, want %q", got, want)
	}
}

func TestFileStorageStoreAndRead(t *testing.T) {
	s, err := NewFileStorage(filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatalf("NewFileStorage: %v", err)
	}

	id := uuid.New()
	content := []byte("hello blob")

	n, sum, err := s.Store(id, bytes.NewReader(content))
	if err != nil {
		t.Fatalf("Store: %v", err)
	}
	if n != int64(len(content)) {
		t.Errorf("Store() wrote %d bytes, want %d", n, len(content))
	}
	wantSum := sha256.Sum256(content)
	if !bytes.Equal(sum, wantSum[:]) {
		t.Errorf("Store() sum = %s, want %s", hex.EncodeToString(sum), hex.EncodeToString(wantSum[:]))
	}

	// The file must live in the shard directory named after the first two
	// hex digits of the UUID and nowhere else.
	if !s.Exists(id) {
		t.Errorf("Exists(%s) = false, want true", id)
	}
	rel, err := filepath.Rel(s.DataPath(), s.Path(id))
	if err != nil {
		t.Fatalf("Rel: %v", err)
	}
	if !strings.HasPrefix(rel, id.String()[:2]+string(os.PathSeparator)) {
		t.Errorf("file stored at %q, want shard prefix %q", rel, id.String()[:2])
	}

	f, err := s.Open(id)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	got, err := io.ReadAll(f)
	if err != nil {
		t.Fatalf("ReadAll: %v", err)
	}
	if !bytes.Equal(got, content) {
		t.Errorf("round-trip content = %q, want %q", got, content)
	}
}

func TestFileStorageStoreOverwrite(t *testing.T) {
	s, err := NewFileStorage(filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatalf("NewFileStorage: %v", err)
	}

	id := uuid.New()
	if _, _, err := s.Store(id, strings.NewReader("old")); err != nil {
		t.Fatalf("Store (old): %v", err)
	}
	_, sum, err := s.Store(id, strings.NewReader("new"))
	if err != nil {
		t.Fatalf("Store (new): %v", err)
	}
	wantSum := sha256.Sum256([]byte("new"))
	if !bytes.Equal(sum, wantSum[:]) {
		t.Errorf("sum after overwrite does not match new content")
	}
}

func TestFileStorageRemove(t *testing.T) {
	s, err := NewFileStorage(filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatalf("NewFileStorage: %v", err)
	}

	id := uuid.New()
	if err := s.Remove(id); err != nil {
		t.Errorf("Remove of non-existent file: %v", err)
	}

	if _, _, err := s.Store(id, strings.NewReader("data")); err != nil {
		t.Fatalf("Store: %v", err)
	}
	if err := s.Remove(id); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if s.Exists(id) {
		t.Errorf("Exists(%s) = true after Remove, want false", id)
	}
}
