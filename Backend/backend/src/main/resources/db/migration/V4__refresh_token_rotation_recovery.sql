-- V4: Add durable rotation recovery columns to refresh_tokens table.
-- Allows safe session recovery from lost proxy responses even after server restarts.
-- The successor token is stored encrypted using AES-256-GCM (never plaintext).
ALTER TABLE refresh_tokens
    ADD COLUMN successor_token_encrypted varchar(512),
    ADD COLUMN client_proof varchar(255);

CREATE INDEX idx_refresh_tokens_client_proof ON refresh_tokens (client_proof);
