# MinIO no longer distributes community binaries/images. Build the pinned official source.
FROM golang:1.24.8-alpine AS build
RUN apk add --no-cache ca-certificates git
RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl
COPY --from=build /go/bin/minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
