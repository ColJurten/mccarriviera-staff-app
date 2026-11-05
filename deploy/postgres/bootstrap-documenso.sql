-- Local synthetic administrator only, after Documenso's migrations have run.
-- Matches the pinned release's createAdminUser password-null/verified model;
-- grant ADMIN directly as prescribed by upstream's self-hosting instructions.
-- Finish via /forgot-password and the reset link caught by Mailpit.
INSERT INTO "User" (name, email, "emailVerified", password, roles)
VALUES ('Synthetic Local Administrator', 'admin@example.test', now(), NULL, ARRAY['USER', 'ADMIN']::"Role"[])
ON CONFLICT (email) DO NOTHING;
