# Gerador de DANFSe (ReceitaFederal/calculadora-rtc-gerador-danfse) para o Vercel.
# Mesmo build do Dockerfile oficial, mas baixando o código e ouvindo na porta PORT.

FROM golang:1.27.1 AS build
ARG REPO=https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git
ARG REF=main
RUN git clone --depth 1 --branch "$REF" "$REPO" /src
WORKDIR /src
RUN go mod download
RUN go install github.com/swaggo/swag/cmd/swag@v1.16.6 \
 && /go/bin/swag init -g cmd/danfse/main.go -o ./api/swagger
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /danfse-service ./cmd/danfse

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=America/Sao_Paulo
COPY --from=build /danfse-service /app/danfse-service
CMD ["sh", "-c", "export SERVER_PORT=${PORT:-80}; exec /app/danfse-service"]
