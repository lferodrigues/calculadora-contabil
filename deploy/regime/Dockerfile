# API do regime geral (ReceitaFederal/calculadora-rtc-regime-regular) para o Vercel.
# O código é baixado do repositório oficial durante o build; o banco SQLite é
# gerado pelo Flyway e embutido na imagem.

FROM maven:3.9-eclipse-temurin-21 AS build
ARG REPO=https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git
ARG REF=main
RUN apt-get update && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "$REF" "$REPO" /src
WORKDIR /src
RUN mkdir -p calculadora/db \
 && mvn -B -q flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf \
 && mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/api-regime-geral.jar /app/app.jar
COPY --from=build /src/calculadora/db/calculadora-pro.db /app/db/calculadora-pro.db
ENV SPRING_PROFILES_ACTIVE=offline

# No Vercel só /tmp é gravável. A API procura ./calculadora/db a partir da pasta
# atual, então o banco é copiado para /tmp e a aplicação roda de lá.
# A porta vem da variável PORT (padrão 80, que é o que o Vercel espera).
CMD ["sh", "-c", "mkdir -p /tmp/calculadora/db && cp -f /app/db/calculadora-pro.db /tmp/calculadora/db/ && cd /tmp && exec java -XX:MaxRAMPercentage=75 -XX:TieredStopAtLevel=1 -Dserver.port=${PORT:-80} -jar /app/app.jar"]
