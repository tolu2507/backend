-- AlterTable
ALTER TABLE "Guardianship" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- Existing links: confirmed when the parent added the child themselves (no school verification),
-- or when the school created the parent's account together with the link. A school link to an
-- account that already existed stays unconfirmed until that parent accepts it in the app.
UPDATE "Guardianship" g
SET "confirmedAt" = g."createdAt"
FROM "User" p
WHERE p.id = g."parentId"
  AND (g."verifiedAt" IS NULL OR p."createdAt" >= g."createdAt" - INTERVAL '10 seconds');
