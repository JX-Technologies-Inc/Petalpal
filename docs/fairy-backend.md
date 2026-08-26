# PetalPal Fairy Backend

The Fairy backend intentionally separates onboarding, ownership/progression, and active runtime.

## Data ownership

- `FairyState` is one-to-one with `User` and stores only resumable onboarding progress.
- `UserFairy` belongs to `User`; one user can own many Fairies.
- Exactly one `UserFairy` per user may have `isActive=true` (enforced by a PostgreSQL partial unique index).
- `FairyRuntime` belongs one-to-one to `UserFairy`, never directly to `User`.
- `FairyMonthlyProgress` is unique by `(userId, month)` and references the Fairy unlocked for that month.

## Onboarding lifecycle

1. Profile creation creates `FairyState(EMPTY_GARDEN)` but does not award an owned Fairy. Onboarding/session responses explicitly include `guideFairyType=BLOOM`, so the frontend can present Bloom from the first screen.
2. Client navigation may advance onboarding monotonically through the existing Fairy-state endpoint. Backward movement is rejected and completion cannot be asserted by the client.
3. The first successful Daily Grow transaction creates the flower, marks onboarding complete, awards the `BLOOM` starter Fairy, creates its runtime, and makes it active.
4. Reopening the app reads the persisted `FairyState`; completed onboarding is never restarted.

## Activity and monthly unlocks

A valid active day is a completed `DailyCheckIn`. The existing unique constraint on `(userId, localDate)` means one local calendar day can count at most once. `localDate` is calculated using the user's IANA timezone and is stored with the timezone used at creation.

The single unlock requirement lives in `lib/fairy-config.js` as `MONTHLY_FAIRY_UNLOCK_ACTIVE_DAYS=20`. Every monthly Fairy requires 20 distinct local active days; activity does not need to be consecutive and never carries into another calendar month. The Daily Grow transaction recomputes active days for that local month. When the threshold is reached, it creates one inactive owned Fairy plus its runtime and links it to the monthly progress row.

Transaction advisory locks serialize progress and active-Fairy changes. Unique constraints protect daily activity, monthly rewards, Fairy types, and the single active Fairy at the database level.

## APIs

All endpoints require the normal Firebase-authenticated PetalPal session.

### `GET /api/fairies`

Returns the owned collection and `activeFairyId`.

### `PUT /api/fairies/:fairyId/active`

Makes an owned Fairy active. A Fairy owned by another user returns `404`.

### `GET /api/fairy/progress?month=YYYY-MM`

Without `month`, the current month is calculated in the user's timezone.

```json
{
  "month": "2026-08",
  "activeDays": 12,
  "requiredDays": 20,
  "progress": 0.6,
  "unlockedThisMonth": false,
  "nextFairy": { "type": "LUMI", "name": "Lumi" },
  "unlockedFairy": null
}
```

### `GET /api/fairy/runtime`

Returns `409` until onboarding is complete. Afterwards it locks and lazily reconciles the active Fairy runtime.

```json
{
  "fairy": {
    "id": "owned-fairy-id",
    "type": "BLOOM",
    "name": "Bloom",
    "level": 1,
    "progression": 0
  },
  "currentState": "UNDER_TREE",
  "currentLocation": "TREE",
  "previousState": "IDLE",
  "previousLocation": "DEFAULT_AREA",
  "stateStartedAt": "2026-08-26T18:00:00.000Z",
  "nextTransitionAt": "2026-08-26T19:42:00.000Z",
  "lastActiveAt": "2026-08-26T18:00:05.000Z",
  "shouldAnimate": true,
  "transitionId": "stable-transition-id",
  "runtimeVersion": 4
}
```

Runtime transitions use centralized durations, valid weighted transitions, and the user's local day/evening/night context. Offline time is reconciled lazily. One recent transition may animate; multiple elapsed transitions return only the final state. No pixel coordinates are stored or returned.

## Frontend boundary

The backend does not implement Fairy assets, collection/selection UI, onboarding visuals, coordinates, or Fly/Land/Sit/Sleep/unlock animations. The frontend maps semantic locations (`DEFAULT_AREA`, `TREE`, `MAILBOX`, `FLOWER`) and `shouldAnimate` to presentation.
