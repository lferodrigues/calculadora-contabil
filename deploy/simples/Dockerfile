# API do Simples Nacional (ReceitaFederal/calculadora-rtc-simples-nacional) para o Vercel.
#
# O repositório oficial NÃO traz os scripts do banco. Forneça o banco de uma
# destas formas:
#   1) coloque o arquivo calculadora-pro.db nesta pasta (deploy/simples/) e faça
#      commit; ele é embutido na imagem; ou
#   2) defina no Vercel a variável DB_DOWNLOAD_URL com a URL base de onde a
#      própria API baixa o banco ao iniciar (comportamento nativo dela).

FROM maven:3.9-eclipse-temurin-21 AS build
ARG REPO=https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git
ARG REF=main
RUN apt-get update && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "$REF" "$REPO" /src
WORKDIR /src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/api-simples-nacional.jar /app/app.jar
# Copia a pasta inteira para não falhar quando o .db não existir.
COPY . /ctx/
RUN mkdir -p /app/db \
 && if [ -f /ctx/calculadora-pro.db ]; then cp /ctx/calculadora-pro.db /app/db/; fi \
 && rm -rf /ctx
ENV SPRING_PROFILES_ACTIVE=offline

# Mesmo esquema do regime geral: roda a partir de /tmp, único lugar gravável.
CMD ["sh", "-c", "mkdir -p /tmp/calculadora/db && if [ -f /app/db/calculadora-pro.db ]; then cp -f /app/db/calculadora-pro.db /tmp/calculadora/db/; fi && cd /tmp && exec java -XX:MaxRAMPercentage=75 -XX:TieredStopAtLevel=1 -Dserver.port=${PORT:-80} -jar /app/app.jar"]
