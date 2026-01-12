-- Initialize database for contex
-- Run this script to set up the initial schema

-- Create signatures table
CREATE TABLE IF NOT EXISTS signatures (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version_id VARCHAR(20) NOT NULL,
    user_agent TEXT NOT NULL,
    terms_hash VARCHAR(64) NOT NULL,
    UNIQUE(ip_address, wallet_address)
);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_signatures_wallet_address ON signatures(wallet_address);

-- Create index on ip_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_signatures_ip_address ON signatures(ip_address);

-- Create composite index for the unique constraint lookup
CREATE INDEX IF NOT EXISTS idx_signatures_ip_wallet ON signatures(ip_address, wallet_address);

-- Grant permissions on the sequence (required for SERIAL primary key)
GRANT USAGE, SELECT ON SEQUENCE signatures_id_seq TO PUBLIC;

-- If using a specific user (uncomment and customize as needed):
-- CREATE USER contex_user WITH PASSWORD 'setMeLater';
-- GRANT CONNECT ON DATABASE contex TO contex_user;
-- GRANT USAGE ON SCHEMA public TO contex_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contex_user;
-- GRANT USAGE, SELECT ON SEQUENCE signatures_id_seq TO contex_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO contex_user;