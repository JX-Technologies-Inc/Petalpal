import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

async function migration(name) {
  return readFile(
    path.join(projectRoot, "prisma", "migrations", name, "migration.sql"),
    "utf8"
  );
}

test("Month 1 vertical slice survives a database restart", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "petalpal-e2e-"));
  let database = new PGlite(dataDirectory);

  try {
    await database.exec(await migration("202608250000_baseline"));
    await database.exec(await migration("202608250001_month1_product_models"));
    await database.exec(await migration("202608250002_firebase_auth"));
    await database.exec(await migration("202608250003_remove_legacy_passwords"));

    // Registration creates the user, garden and resumable onboarding state.
    await database.exec(`
      INSERT INTO "User"
        ("id", "accountId", "name", "email", "firebaseUid", "emailVerifiedAt", "timezone")
      VALUES
        ('vertical-user', 'PP0001', 'Bloom', 'bloom@example.com', 'firebase-verified-user', CURRENT_TIMESTAMP, 'America/Vancouver');
      INSERT INTO "Garden" ("id", "ownerId")
      VALUES ('vertical-garden', 'vertical-user');
      INSERT INTO "FairyState" ("id", "userId", "updatedAt")
      VALUES ('vertical-fairy', 'vertical-user', CURRENT_TIMESTAMP);
      UPDATE "FairyState"
      SET "onboardingStep" = 'MOOD_SELECTION',
          "lastEvent" = 'FAIRY_APPEARS',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = 'vertical-user';
    `);

    // One transaction stores the check-in, optional journal, emotion and flower.
    await database.transaction(async (transaction) => {
      await transaction.exec(`
        INSERT INTO "DailyCheckIn"
          ("id", "userId", "localDate", "timezone", "updatedAt")
        VALUES
          ('vertical-checkin', 'vertical-user', '2026-08-25', 'America/Vancouver', CURRENT_TIMESTAMP);
        INSERT INTO "Journal"
          ("id", "userId", "dailyCheckInId", "content", "updatedAt")
        VALUES
          ('vertical-journal', 'vertical-user', 'vertical-checkin', 'A peaceful afternoon', CURRENT_TIMESTAMP);
        INSERT INTO "EmotionResult"
          ("id", "userId", "dailyCheckInId", "label", "source")
        VALUES
          ('vertical-emotion', 'vertical-user', 'vertical-checkin', 'calm', 'USER');
        INSERT INTO "Flower"
          ("id", "mood", "event", "name", "meaning", "img", "left", "top", "userId", "gardenId", "dailyCheckInId")
        VALUES
          ('vertical-flower', 'calm', 'A peaceful afternoon', 'Lotus', 'Peace', '/assets/blue.png', 100, 300, 'vertical-user', 'vertical-garden', 'vertical-checkin');
        UPDATE "FairyState"
        SET "onboardingStep" = 'GARDEN_UNLOCKED',
            "onboardingCompleted" = true,
            "lastEvent" = 'FLOWER_BLOOM',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = 'vertical-user';
      `);
    });

    await assert.rejects(
      database.exec(`
        INSERT INTO "DailyCheckIn"
          ("id", "userId", "localDate", "timezone", "updatedAt")
        VALUES
          ('duplicate', 'vertical-user', '2026-08-25', 'America/Vancouver', CURRENT_TIMESTAMP);
      `),
      /unique|duplicate/i
    );

    await database.close();

    // Simulate a process/database restart and log in again.
    database = new PGlite(dataDirectory);
    const restored = await database.query(`
      SELECT
        u."email",
        u."firebaseUid",
        u."emailVerifiedAt",
        f."onboardingCompleted",
        f."onboardingStep",
        d."localDate",
        j."content",
        e."label" AS emotion,
        flower."name" AS flower
      FROM "User" u
      JOIN "FairyState" f ON f."userId" = u."id"
      JOIN "DailyCheckIn" d ON d."userId" = u."id"
      LEFT JOIN "Journal" j ON j."dailyCheckInId" = d."id"
      JOIN "EmotionResult" e ON e."dailyCheckInId" = d."id"
      JOIN "Flower" flower ON flower."dailyCheckInId" = d."id"
      WHERE u."id" = 'vertical-user'
    `);

    assert.deepEqual(restored.rows[0], {
      email: "bloom@example.com",
      firebaseUid: "firebase-verified-user",
      emailVerifiedAt: restored.rows[0].emailVerifiedAt,
      onboardingCompleted: true,
      onboardingStep: "GARDEN_UNLOCKED",
      localDate: "2026-08-25",
      content: "A peaceful afternoon",
      emotion: "calm",
      flower: "Lotus"
    });
    assert.ok(restored.rows[0].emailVerifiedAt);
  } finally {
    await database.close().catch(() => {});
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
