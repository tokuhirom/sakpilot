.PHONY: generate ogen build lint

generate: ogen

ogen:
	ogen --target internal/apprun --package apprun --clean openapis/apprun-dedicated.json

build:
	go build ./...

lint:
	golangci-lint run
