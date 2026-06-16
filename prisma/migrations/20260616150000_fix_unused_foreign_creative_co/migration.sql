-- "Creativo extranjero sin usar en CO" solo aplica a anuncios EXTRANJEROS. Un
-- anuncio con País = CO no puede llevar ese flag (su creativo ya está en CO).
-- Corrige los históricos que quedaron marcados (p. ej. por z.coerce.boolean
-- convirtiendo el string "false" en true).
UPDATE "ads" SET "hasUnusedForeignCreative" = false WHERE "country" = 'CO' AND "hasUnusedForeignCreative" = true;
