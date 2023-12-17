CREATE TABLE IF NOT EXISTS node (
    id TEXT PRIMARY KEY,
    subdomain TEXT NOT NULL,
    slug TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS subdomain (
    subdomain TEXT PRIMARY KEY,
    token TEXT
);