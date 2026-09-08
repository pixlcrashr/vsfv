package main

import (
	"flag"
	"fmt"
	"os"

	_db "github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/dialect"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gen"
	"gorm.io/gorm"
)

func main() {
	dsn := flag.String("dsn", "postgres://vsf:postgres@127.0.0.1:5335/vsf?sslmode=disable", "Database DSN")
	outPath := flag.String("o", "../../pkg/db/model/dao", "Output path")
	flag.Parse()

	if err := os.RemoveAll(*outPath); err != nil {
		panic(err)
	}

	g := gen.NewGenerator(gen.Config{
		OutPath:       *outPath,
		Mode:          gen.WithDefaultQuery | gen.WithQueryInterface,
		FieldNullable: true,
	})

	d, connStr, err := _db.ParseDialect(*dsn)
	if err != nil {
		panic(err)
	}

	var dialector gorm.Dialector
	switch d {
	case dialect.PostgreSQL:
		dialector = postgres.Open(connStr)
	case dialect.SQLite:
		dialector = sqlite.Open(connStr)
	default:
		panic(fmt.Sprintf("unsupported dialect %q", d))
	}

	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		panic(err)
	}

	g.UseDB(db)

	g.ApplyBasic(
		_db.Models...,
	)

	g.Execute()
}
