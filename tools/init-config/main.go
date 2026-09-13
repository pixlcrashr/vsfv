package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"gopkg.in/yaml.v3"
	"gorm.io/gorm"
)

// Config describes the small YAML configuration for the bootstrap tool.
type Config struct {
	Database struct {
		DSN string `yaml:"dsn"`
	} `yaml:"database"`
	User struct {
		Email    string `yaml:"email"`
		Name     string `yaml:"name"`
		Password string `yaml:"password"`
	} `yaml:"user"`
	Organization struct {
		DisplayName        string `yaml:"display_name"`
		DisplayDescription string `yaml:"description"`
		StartMonth         int    `yaml:"start_month"`
		CustomID           string `yaml:"custom_id"`
	} `yaml:"organization"`
	AssignAdminGroup bool `yaml:"assign_admin_group"`
}

func main() {
	cfgFile := flag.String("c", "./init-config.yaml", "config file")
	flag.Parse()

	cfg, err := loadConfig(*cfgFile)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := validateConfig(cfg); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	gormDB, err := db.ConnectSilent(cfg.Database.DSN)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		log.Fatalf("get underlying sql.DB: %v", err)
	}
	defer sqlDB.Close()

	enforcer, err := authz.NewEnforcer(gormDB)
	if err != nil {
		log.Fatalf("create enforcer: %v", err)
	}

	ctx := context.Background()
	if err := authz.SeedAdminGroup(ctx, gormDB, enforcer); err != nil {
		log.Fatalf("seed admin group: %v", err)
	}

	if err := run(ctx, gormDB, enforcer, cfg); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	log.Println("bootstrap complete")
}

func loadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %q: %w", path, err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse %q: %w", path, err)
	}

	return &cfg, nil
}

func validateConfig(cfg *Config) error {
	if cfg.Database.DSN == "" {
		return fmt.Errorf("database.dsn is required")
	}
	if cfg.User.Email == "" {
		return fmt.Errorf("user.email is required")
	}
	if cfg.User.Name == "" {
		return fmt.Errorf("user.name is required")
	}
	if cfg.Organization.DisplayName == "" {
		return fmt.Errorf("organization.display_name is required")
	}
	if cfg.Organization.StartMonth < 1 || cfg.Organization.StartMonth > 12 {
		return fmt.Errorf("organization.start_month must be between 1 and 12")
	}
	return nil
}

func run(ctx context.Context, gormDB *gorm.DB, enforcer *authz.Enforcer, cfg *Config) error {
	return gormDB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		org, orgCreated, err := ensureOrganization(ctx, tx, cfg)
		if err != nil {
			return err
		}

		user, userCreated, err := ensureUser(ctx, tx, cfg)
		if err != nil {
			return err
		}

		if cfg.AssignAdminGroup && userCreated {
			if err := assignAdminGroup(ctx, tx, enforcer, user.ID); err != nil {
				return err
			}
		}

		if orgCreated {
			log.Printf("created organization %s (custom ID: %s, name: %s)", org.ID, org.CustomID, org.DisplayName)
		} else {
			log.Printf("organization already exists (custom ID: %s, name: %s); skipped", org.CustomID, org.DisplayName)
		}

		if userCreated {
			log.Printf("created user %s (email: %s)", user.ID, user.Email)
		} else {
			log.Printf("user already exists (email: %s); skipped", user.Email)
		}

		if cfg.AssignAdminGroup && userCreated {
			log.Printf("assigned user %s to admin group", user.ID)
		}

		return nil
	})
}

func ensureOrganization(ctx context.Context, tx *gorm.DB, cfg *Config) (*model.Organization, bool, error) {
	repo := repository.NewOrganizationRepository(tx)

	if cfg.Organization.CustomID != "" {
		exists, err := repo.ExistsByCustomID(ctx, cfg.Organization.CustomID)
		if err != nil {
			return nil, false, fmt.Errorf("check organization: %w", err)
		}
		if exists {
			org, err := repo.GetByResourceName(ctx, cfg.Organization.CustomID)
			if err != nil {
				return nil, false, fmt.Errorf("get existing organization: %w", err)
			}
			return org, false, nil
		}
	}

	org, err := repo.Create(ctx, repository.CreateOrganizationParams{
		DisplayName:        cfg.Organization.DisplayName,
		DisplayDescription: cfg.Organization.DisplayDescription,
		StartMonth:         time.Month(cfg.Organization.StartMonth),
		CustomID:           cfg.Organization.CustomID,
	})
	if err != nil {
		return nil, false, fmt.Errorf("create organization: %w", err)
	}
	return org, true, nil
}

func ensureUser(ctx context.Context, tx *gorm.DB, cfg *Config) (*model.User, bool, error) {
	repo := repository.NewUserRepository(tx)

	existing, err := repo.GetByEmail(ctx, cfg.User.Email)
	if err == nil {
		return existing, false, nil
	}
	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, false, fmt.Errorf("check user: %w", err)
	}

	var user *model.User
	if cfg.User.Password != "" {
		user, err = repo.CreateWithPassword(ctx, repository.CreateUserWithPasswordParams{
			Email:    cfg.User.Email,
			Name:     cfg.User.Name,
			Password: cfg.User.Password,
		})
	} else {
		user = &model.User{Email: cfg.User.Email, Name: cfg.User.Name}
		err = tx.WithContext(ctx).Create(user).Error
	}
	if err != nil {
		return nil, false, fmt.Errorf("create user: %w", err)
	}
	return user, true, nil
}

func assignAdminGroup(ctx context.Context, tx *gorm.DB, enforcer *authz.Enforcer, userID uuid.UUID) error {
	groupRepo := repository.NewUserGroupRepository(tx, enforcer)
	group, err := groupRepo.GetByCustomID(ctx, authz.AdminGroupCustomID)
	if err != nil {
		return fmt.Errorf("get admin group: %w", err)
	}

	if _, err := enforcer.AddGlobalGroupingPolicy(userID.String(), group.ID.String()); err != nil {
		return fmt.Errorf("assign user to admin group: %w", err)
	}

	if err := enforcer.Flush(); err != nil {
		return fmt.Errorf("flush enforcer after group assignment: %w", err)
	}

	return nil
}
