-- Preferencia de apariencia por usuario (light | dark | reading), persistente.
ALTER TABLE "users" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'dark';
