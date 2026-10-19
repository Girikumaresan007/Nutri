# ==============================================================================
# NutriTrack AI — Backend Multi-Stage Production Dockerfile
# Builds with Maven on Eclipse Temurin 17; Runs on minimal hardened JRE 17
# ==============================================================================

# Stage 1: Build JAR using Maven
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Cache dependency layer
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build production artifact
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Minimal hardened production runtime
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Add non-root application user for defense-in-depth container security
RUN addgroup -S nutritrack && adduser -S nutritrack -G nutritrack

# Copy built jar from builder stage
COPY --from=builder /build/target/nutritrack-backend-*.jar app.jar
RUN chown -R nutritrack:nutritrack /app

USER nutritrack

ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8080 \
    PORT=8080

EXPOSE 8080

# Configure JVM flags for container awareness and fast startup
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-jar", "/app/app.jar"]
