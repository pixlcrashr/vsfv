// Package storage implements the global file storage that holds every
// binary blob the application persists. Files are identified by UUIDs and
// stored in a sharded directory tree rooted at the configured data path:
//
//	<data path>/
//	  00/<all files whose UUID starts with 00>
//	  01/<all files whose UUID starts with 01>
//	  ...
//	  ff/<all files whose UUID starts with ff>
//
// Resolving the path of a file is a pure string computation on the UUID, so
// lookups are fast and never touch the filesystem, and the files are spread
// evenly over 256 shard directories.
package storage

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

// FileStorage is the global blob storage. All binary blobs live in the same
// space rooted at the data path the FileStorage was created with.
type FileStorage struct {
	dataPath string
}

// NewFileStorage creates a FileStorage rooted at the given data path and
// creates the directory if it does not exist yet.
func NewFileStorage(dataPath string) (*FileStorage, error) {
	root, err := filepath.Abs(dataPath)
	if err != nil {
		return nil, fmt.Errorf("resolving data path: %w", err)
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("creating data path: %w", err)
	}
	return &FileStorage{dataPath: root}, nil
}

// DataPath returns the absolute path of the directory the files reside in.
func (s *FileStorage) DataPath() string { return s.dataPath }

// Path returns the path of the file identified by id:
// <data path>/<first two hex digits of id>/<id>.
func (s *FileStorage) Path(id uuid.UUID) string {
	key := id.String()
	return filepath.Join(s.dataPath, key[:2], key)
}

// Exists reports whether a file with the given id exists.
func (s *FileStorage) Exists(id uuid.UUID) bool {
	_, err := os.Stat(s.Path(id))
	return err == nil
}

// Store writes the contents of r under id and returns the number of bytes
// written and the SHA-256 sum of the stored data. A partially written file
// is removed again if writing fails.
func (s *FileStorage) Store(id uuid.UUID, r io.Reader) (n int64, sum []byte, err error) {
	path := s.Path(id)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return 0, nil, fmt.Errorf("creating shard directory: %w", err)
	}

	f, err := os.Create(path)
	if err != nil {
		return 0, nil, fmt.Errorf("creating file: %w", err)
	}
	defer f.Close()

	hash := sha256.New()
	n, err = io.Copy(f, io.TeeReader(r, hash))
	if err != nil {
		_ = os.Remove(path)
		return 0, nil, fmt.Errorf("writing file: %w", err)
	}
	return n, hash.Sum(nil), nil
}

// Open opens the file identified by id for reading.
func (s *FileStorage) Open(id uuid.UUID) (*os.File, error) {
	f, err := os.Open(s.Path(id))
	if err != nil {
		return nil, fmt.Errorf("opening file %s: %w", id, err)
	}
	return f, nil
}

// Remove deletes the file identified by id. Removing a file that does not
// exist is not an error.
func (s *FileStorage) Remove(id uuid.UUID) error {
	if err := os.Remove(s.Path(id)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing file %s: %w", id, err)
	}
	return nil
}
