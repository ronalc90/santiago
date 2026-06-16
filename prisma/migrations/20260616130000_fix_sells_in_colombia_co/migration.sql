-- Corrige datos históricos: los anuncios del Ad Library de Colombia (country = 'CO')
-- se están vendiendo en Colombia por definición, pero se ingestaban con
-- sellsInColombia = false (el payload de Apify no trae ese campo). Eso los hacía
-- aparecer en el filtro "No se vende en CO" pese a tener País = Colombia.
UPDATE "ads" SET "sellsInColombia" = true WHERE "country" = 'CO' AND "sellsInColombia" = false;
