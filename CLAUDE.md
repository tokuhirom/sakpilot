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

### Sakura Cloud SDK

さくらのクラウドのSDKは `iaas-api-go` に含まれていない場合、[sacloud org](https://github.com/sacloud) の別リポジトリに存在することが多い：

- `github.com/sacloud/iaas-api-go` - IaaS API（サーバー、ディスク、DNS等）
- `github.com/sacloud/apprun-api-go` - AppRun API
- `github.com/sacloud/object-storage-api-go` - オブジェクトストレージ API
- `github.com/sacloud/kms-api-go` - KMS API
- `github.com/sacloud/webaccel-api-go` - ウェブアクセラレータ API

新しいサービスに対応する際は、まず sacloud org で専用のAPIライブラリを探すこと。

## Git Workflow

- mainブランチに直接コミットしない。必ずブランチを作成してPRを出すこと
- ブランチ作成前に `git fetch origin main` で最新を取得
- ブランチは `origin/main` から作成: `git checkout -b feature/xxx origin/main`
- 作業完了後は `git push -u origin feature/xxx` でプッシュ
- `gh pr create` でPR作成

## Style Guidelines

### Table Styling

- `<td>` elements should be **left-aligned** by default. Avoid centering text in table cells as it reduces readability.
- When creating detail pages or tables, always use `textAlign: 'left'` for td elements if needed.

### Profile Switching

- プロファイル切り替え時は、右側ペインの詳細情報を必ずクリアすること
- `handleSwitchProfile` で以下の状態をリセット：
  - 選択中の詳細情報（`selectedDNSId`, `selectedGSLBId`, `selectedContainerRegistry` 等）
  - オブジェクトストレージのパンくず状態
  - 詳細ページにいる場合はリストページに戻す

### Date Formatting

- Date/time should be formatted as `YYYY/MM/DD HH:MM:SS`
- Use this helper function:
```typescript
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};
```
