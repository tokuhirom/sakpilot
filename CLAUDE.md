# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Live development with hot reload
wails dev

# Production build (outputs to build/bin/)
wails build

# Regenerate Go->TypeScript bindings after modifying app.go
wails generate module

# Frontend only
cd frontend && npm install
cd frontend && npm run build
```

## Architecture

SakPilot is a desktop app for managing Sakura Cloud infrastructure, built with Wails (Go backend + React frontend).

### Backend (Go)

- `main.go` - Wails app initialization, embeds frontend assets via `//go:embed`
- `app.go` - Exposes RPC methods to frontend (authentication, server operations, global resources)
- `internal/sakura/` - Sakura Cloud API integration
  - `client.go` - API client wrapper using `github.com/sacloud/iaas-api-go`
  - `server.go` - Zone-specific server operations (list, power on/off)
  - `global.go` - Zone-independent resources (DNS, certificates, simple monitors)
  - `zone.go` - Available zone definitions (is1a, is1b, tk1a, tk1b, tk1v)

### Frontend (React + TypeScript)

- `frontend/src/App.tsx` - Single component app with login, sidebar navigation, and three views
- `frontend/wailsjs/go/` - Auto-generated TypeScript bindings for Go methods (regenerate with `wails generate module`)

### Key Concepts

**Zone-dependent vs Global resources**: Sakura Cloud has zone-specific resources (servers, disks) requiring zone selection, and global resources (DNS, monitoring) that are zone-independent. The UI sidebar separates these categories.

**Wails RPC**: Go methods in `app.go` with uppercase names are automatically exposed to frontend. Changes to these methods require regenerating bindings.

## Dependencies

- Go: `github.com/sacloud/iaas-api-go` - Sakura Cloud IaaS API
- Frontend: React 18, TypeScript, Vite

## Style Guidelines

### Table Styling

- `<td>` elements should be **left-aligned** by default. Avoid centering text in table cells as it reduces readability.
- When creating detail pages or tables, always use `textAlign: 'left'` for td elements if needed.
