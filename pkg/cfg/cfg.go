package cfg

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server          Server          `mapstructure:"server"`
	Database        Database        `mapstructure:"database"`
	Auth            Auth            `mapstructure:"auth"`
	Gotenberg       Gotenberg       `mapstructure:"gotenberg"`
	CORS            CORS            `mapstructure:"cors"`
	Storage         Storage         `mapstructure:"storage"`
	SubmissionDecay SubmissionDecay `mapstructure:"submission-decay"`
}

// Storage configures local file storage for submission attachments.
type Storage struct {
	// AttachmentsPath is the directory where submission attachment binaries
	// are stored.
	AttachmentsPath string `mapstructure:"attachments-path"`
}

// SubmissionDecay configures the background sweeper that automatically
// rejects pending submissions once the organization-wide deadline has passed.
type SubmissionDecay struct {
	// Interval between sweeps. Defaults to one hour.
	Interval time.Duration `mapstructure:"interval"`
}

type Server struct {
	Address     string `mapstructure:"addr"`
	GRPCAddress string `mapstructure:"grpc-addr"`
	PublicURL   string `mapstructure:"public-url"`
}

type Database struct {
	DSN string `mapstructure:"dsn"`
}

type Auth struct {
	Secret          string        `mapstructure:"secret"`
	TokenTTL        time.Duration `mapstructure:"token-ttl"`
	RefreshTTL      time.Duration `mapstructure:"refresh-ttl"`
	SessionTTL      time.Duration `mapstructure:"session-ttl"`
	SecureCookies   bool          `mapstructure:"secure-cookies"`
	WebRedirectURIs []string      `mapstructure:"web-redirect-uris"`
	JWKS            JWKSConfig    `mapstructure:"jwks"`
	GitLab          GitLabOAuth   `mapstructure:"gitlab"`
	Password        PasswordAuth  `mapstructure:"password"`
}

type GitLabOAuth struct {
	Enabled      bool   `mapstructure:"enabled"`
	ClientID     string `mapstructure:"client-id"`
	ClientSecret string `mapstructure:"client-secret"`
	Issuer       string `mapstructure:"issuer"`
}

type PasswordAuth struct {
	Enabled bool `mapstructure:"enabled"`
}

type JWKSConfig struct {
	KeyFiles []string `mapstructure:"key-files"`
}

type Gotenberg struct {
	URL string `mapstructure:"url"`
}

type CORS struct {
	Enabled          bool     `mapstructure:"enabled"`
	AllowOrigins     []string `mapstructure:"allow-origins"`
	AllowMethods     []string `mapstructure:"allow-methods"`
	AllowHeaders     []string `mapstructure:"allow-headers"`
	ExposeHeaders    []string `mapstructure:"expose-headers"`
	AllowCredentials bool     `mapstructure:"allow-credentials"`
	MaxAge           int      `mapstructure:"max-age"`
}

func Load(cfgFile string) (*Config, error) {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
		viper.AddConfigPath(".")
		viper.AddConfigPath("$HOME/.vsfv")
		viper.AddConfigPath("/etc/vsfv")
	}

	viper.SetEnvPrefix("VSFV")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
	viper.AutomaticEnv()

	viper.SetDefault("server.addr", "127.0.0.1:8080")
	viper.SetDefault("server.grpc-addr", "127.0.0.1:9090")
	viper.SetDefault("gotenberg.url", "http://127.0.0.1:3000")
	viper.SetDefault("cors.enabled", false)
	viper.SetDefault("cors.allow-origins", []string{"*"})
	viper.SetDefault("cors.allow-methods", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allow-headers", []string{"Origin", "Content-Type", "Accept", "Authorization"})
	viper.SetDefault("cors.expose-headers", []string{})
	viper.SetDefault("cors.allow-credentials", false)
	viper.SetDefault("cors.max-age", 300)

	viper.SetDefault("server.public-url", "http://127.0.0.1:8080")
	viper.SetDefault("auth.token-ttl", time.Hour)
	viper.SetDefault("auth.refresh-ttl", 720*time.Hour)
	viper.SetDefault("auth.session-ttl", 24*time.Hour)
	viper.SetDefault("auth.secure-cookies", false)
	viper.SetDefault("auth.web-redirect-uris", []string{})
	viper.SetDefault("auth.gitlab.enabled", false)
	viper.SetDefault("auth.password.enabled", false)
	viper.SetDefault("auth.jwks.key-files", []string{})
	viper.SetDefault("storage.attachments-path", "attachments")
	viper.SetDefault("submission-decay.interval", time.Hour)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config: %w", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshalling config: %w", err)
	}

	return &cfg, nil
}
