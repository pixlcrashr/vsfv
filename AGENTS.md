# Agent Instructions

## Project Overview

This is a Go API server (`github.com/pixlcrashr/vsfv`) that exposes a single protobuf-first HTTP/JSON API plus a small set of Huma-hosted exception endpoints on the same Fiber server:

1. **gRPC-Gateway REST/JSON API** (primary) — defined via Protocol Buffers in `proto/`, generated into `pkg/grpc/gen/`, and served in-process via `pkg/api/grpc/http_server.go` (pure HTTP/JSON transcoding, no TCP gRPC port; service implementations live in `pkg/api/grpc/services/`). All routes live under `/api/v1/`.
2. **Huma exception endpoints** (secondary) — a small number of routes that cannot be expressed as protobuf CRUD (binary uploads/downloads such as XML import/export and submission attachments). They are registered via the `humafiber` API in `pkg/api/router.go` and **must be mounted before the gateway's `/api/v1/*` catch-all** (Fiber matches routes in registration order). They are self-documented by Huma's OpenAPI endpoint (`/openapi`).

## Proto Code Generation

All gRPC service definitions live in `proto/`. After changing any `.proto` file you **must** regenerate the Go code.

Use the Taskfile tasks (requires [Task](https://taskfile.dev) installed):

```sh
# Validate all proto files
task proto:build

# Generate Go code (gRPC stubs, grpc-gateway, AIP helpers, OpenAPI docs)
task proto:generate
```

These are equivalent to running `buf build` and `buf generate` directly from the repo root.

Generated output directories:
- `pkg/grpc/gen/` — protoc-gen-go, protoc-gen-go-grpc, protoc-gen-go-aip, protoc-gen-grpc-gateway output
- `docs/proto/` — protoc-gen-doc HTML output
- `openapi.swagger.yaml` — merged OpenAPI v2 spec (protoc-gen-openapiv2 output); the Angular client (`web/package.json` → `generate:apiV2`) is generated from this file

**`pkg/grpc/gen/` is read-only at all times. Never manually edit any file in this directory.** All files are fully regenerated on every `task proto:generate` run (equivalent to `buf generate`). Treat any file in this directory as a build artifact.

## DAO Code Generation

All GORM DAO query files live in `pkg/db/model/dao/`. After changing any model in `pkg/db/model/` you **must** regenerate the DAO code.

Use the `go:generate` directive in `pkg/db/model/dao.go`:

```sh
go generate ./pkg/db/model/
# or equivalently:
go run ./tools/gen-dao/main.go -o ./pkg/db/model/dao
```

**`pkg/db/model/dao/` is read-only at all times. Never manually edit any file in this directory.** All files are fully regenerated on every `go generate` run. Treat any file in this directory as a build artifact.

## Proto Style Rules

- Package: `pixlcrashr.vsfv.v1`
- One service per entity file (e.g. `proto/account.proto` → `AccountService`)
- Follow [Google AIP](https://aip.dev) guidelines: standard methods (Get/List/Create/Update/Delete) plus custom methods with the `:verb` suffix
- Use `google.api.resource` + `google.api.resource_reference` on all resource messages and name fields
- Use `google.protobuf.FieldMask` on all Update requests
- **Do not use the `optional` keyword** (proto3 optional) — `protoc-gen-go-aip` does not support it. Use a `oneof` wrapper instead for nullable scalars
- Binary uploads/downloads (file transfer) never go through proto — no streaming or file RPCs; binary transfer belongs to the Huma exception endpoints

## Adding a New Service

1. Create `proto/<entity>.proto` with the service definition
2. Run `task proto:generate`
3. Add the new `Unimplemented<Entity>ServiceServer` field to `pkg/api/grpc/services/services.go`
4. Call `gen.Register<Entity>ServiceHandlerServer(ctx, mux, svc.<Entity>)` in `pkg/api/grpc/server.go`
5. Implement the real server by replacing the `Unimplemented` stub with a concrete struct

## Huma Exception Endpoint Style Rules

Routes that cannot be expressed as protobuf CRUD (binary uploads/downloads etc.) are implemented as **Huma operations** and registered in `pkg/api/router.go` (via the `humafiber` adapter) **before** the grpc-gateway `/api/v1/*` catch-all, so Fiber's registration-order matching picks them first. They are self-documented via Huma's `/openapi`.

Conventions:

### URL paths
- Resource collection names are **camelCase** (e.g. `/transactionAccounts`, `/reportTemplates`, `/importSources`)
- Path parameter placeholders are **snake_case** (e.g. `{transaction_id}`, `{submission_id}`, `{item_id}`)
- All routes are prefixed with `/api/v1/` (same top-level namespace as the grpc-gateway API; custom verbs may use the AIP-style `:verb` suffix, e.g. `data:export-xml`, `attachments/{attachment_id}:download`)

### Request / response field tags
- `path:"..."` tags — **snake_case** (matches the `{snake_case}` placeholder in the route path)
- `header:"..."` / `query:"..."` tags — **snake_case** (e.g. `page_size`, `page_token`, `show_deleted`)
- `json:"..."` tags — **snake_case** for all body fields (e.g. `organization_id`, `file_name`, `create_time`)

### Authentication & error bodies
- Authenticate with `pkg/api/humax`: declare `Authorization string \`header:"Authorization"\`` on the input struct and call `humax.Auth(ctx, authDeps, input.Authorization)` first; permission checks use `humax.CheckGlobal` / the enforcer
- Keep the legacy error body shape `{"error": "..."}` (via `humax.NewError`) so the SPA's error handling keeps working

### Soft-delete / archive fields (AIP-132/164)
- List requests that support soft-deleted resources expose a `show_deleted` query parameter (bool, default false)
- The corresponding Go struct field may be named `IncludeArchived` or `IncludeClosed` — only the tag/parameter name must be `show_deleted`

## Database Migrations

**NEVER manually create or edit migration files in `migrations/postgresql/`.** Migration files are generated automatically by [Atlas](https://atlasgo.io) from the GORM models.

When a schema change is needed:
1. Modify the relevant GORM model(s) in `pkg/db/model/`
2. Regenerate the DAO code: `go generate ./pkg/db/model/`
3. Ask the user to run Atlas to generate the migration from the model diff

`migrations/postgresql/` is effectively **read-only** for agents. Treat it the same as `pkg/grpc/gen/` and `pkg/db/model/dao/`.

## Key Directories

| Path | Purpose |
|---|---|
| `proto/` | Protobuf service definitions (source of truth for gRPC API) |
| `pkg/grpc/gen/` | Generated Go code — **read-only**, regenerate with `buf generate` |
| `pkg/api/grpc/services/` | Service container; wire real implementations here |
| `pkg/api/grpc/server.go` | Registers grpc-gateway routes onto the Fiber app |
| `pkg/api/` | Huma exception endpoints (e.g. `importexport/xmlformat`, `attachments`); registered in `pkg/api/router.go` before the gateway catch-all |
| `pkg/api/humax/` | Shared plumbing for Huma exception endpoints (auth, legacy error shape) |
| `pkg/db/model/` | GORM database models |
| `pkg/db/model/dao/` | Generated DAO query code — **read-only**, regenerate with `go generate ./pkg/db/model/` |
| `pkg/db/repository/` | Database repository layer |
