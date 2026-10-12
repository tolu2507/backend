-- Schools can ask children to type their PIN at the tuck shop too (off by default).
ALTER TABLE "School" ADD COLUMN "tuckShopRequirePin" BOOLEAN NOT NULL DEFAULT false;

-- Parent-set daily tuck-shop limit (default ₦1,500; NULL = no limit).
ALTER TABLE "StudentProfile" ADD COLUMN "dailySpendLimitKobo" BIGINT DEFAULT 150000;

-- Every child gets a tuck-shop ID: 3 letters of their first name + 4 characters, e.g. ADAK7M2.
ALTER TABLE "StudentProfile" ADD COLUMN "shopCode" TEXT;
UPDATE "StudentProfile" sp
SET "shopCode" = upper(left(regexp_replace(u."firstName", '[^A-Za-z]', '', 'g') || 'XXX', 3))
              || translate(upper(substr(md5(random()::text || sp.id), 1, 4)), '01', 'QR')
FROM "User" u
WHERE u.id = sp."userId";
ALTER TABLE "StudentProfile" ALTER COLUMN "shopCode" SET NOT NULL;
CREATE UNIQUE INDEX "StudentProfile_shopCode_key" ON "StudentProfile"("shopCode");
