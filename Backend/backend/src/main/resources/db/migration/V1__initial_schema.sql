-- NutriTrack AI initial schema.
-- Timezone policy: audit columns are timestamptz (UTC). User-selected calendar dates are plain DATE columns and are
-- never shifted between timezones, so the day a user picked is the day that is stored and reported.

CREATE TABLE users (
    id            uuid PRIMARY KEY,
    email         varchar(254) NOT NULL UNIQUE,
    password_hash varchar(100) NOT NULL,
    created_at    timestamptz  NOT NULL,
    updated_at    timestamptz  NOT NULL,
    CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE user_profiles (
    id                 uuid PRIMARY KEY,
    user_id            uuid         NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    name               varchar(100) NOT NULL,
    date_of_birth      date,
    height_cm          numeric(6, 2),
    current_weight_kg  numeric(6, 2),
    biological_sex     varchar(20)  NOT NULL DEFAULT 'UNSPECIFIED',
    activity_level     varchar(20)  NOT NULL DEFAULT 'MODERATE',
    goal_type          varchar(20)  NOT NULL DEFAULT 'MAINTAIN',
    target_weight_kg   numeric(6, 2),
    weight_unit        varchar(5)   NOT NULL DEFAULT 'KG',
    height_unit        varchar(10)  NOT NULL DEFAULT 'CM',
    profile_updated_at timestamptz,
    created_at         timestamptz  NOT NULL,
    updated_at         timestamptz  NOT NULL,
    CONSTRAINT profiles_sex_chk CHECK (biological_sex IN ('MALE', 'FEMALE', 'UNSPECIFIED')),
    CONSTRAINT profiles_activity_chk CHECK (activity_level IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
    CONSTRAINT profiles_goal_chk CHECK (goal_type IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT', 'BUILD_MUSCLE')),
    CONSTRAINT profiles_wunit_chk CHECK (weight_unit IN ('KG', 'LBS')),
    CONSTRAINT profiles_hunit_chk CHECK (height_unit IN ('CM', 'FT_IN'))
);

CREATE TABLE refresh_tokens (
    id         uuid PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,   -- SHA-256 hex of the opaque token; the raw token is never stored
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

CREATE TABLE nutrition_goals (
    id               uuid PRIMARY KEY,
    user_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    effective_from   date          NOT NULL,
    goal_type        varchar(20)   NOT NULL,
    daily_calories   integer       NOT NULL CHECK (daily_calories BETWEEN 800 AND 10000),
    protein          numeric(8, 2) NOT NULL CHECK (protein >= 0),
    carbohydrates    numeric(8, 2) NOT NULL CHECK (carbohydrates >= 0),
    fat              numeric(8, 2) NOT NULL CHECK (fat >= 0),
    fiber            numeric(8, 2) NOT NULL CHECK (fiber >= 0),
    target_weight_kg numeric(6, 2),
    created_at       timestamptz   NOT NULL,
    updated_at       timestamptz   NOT NULL,
    CONSTRAINT goals_type_chk CHECK (goal_type IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT', 'BUILD_MUSCLE')),
    CONSTRAINT goals_unique_effective UNIQUE (user_id, effective_from)
);

CREATE TABLE food_entries (
    id            uuid PRIMARY KEY,
    user_id       uuid           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    entry_date    date           NOT NULL,
    meal          varchar(20)    NOT NULL,
    name          varchar(200)   NOT NULL,
    quantity      numeric(12, 2) NOT NULL CHECK (quantity > 0),
    unit          varchar(30)    NOT NULL,
    -- nutrition snapshot: stored with the entry and never recomputed from reference data
    calories      numeric(8, 2)  NOT NULL CHECK (calories BETWEEN 0 AND 10000),
    protein       numeric(8, 2)  NOT NULL CHECK (protein BETWEEN 0 AND 2000),
    carbohydrates numeric(8, 2)  NOT NULL CHECK (carbohydrates BETWEEN 0 AND 2000),
    fat           numeric(8, 2)  NOT NULL CHECK (fat BETWEEN 0 AND 2000),
    fiber         numeric(8, 2)  NOT NULL CHECK (fiber BETWEEN 0 AND 2000),
    notes         varchar(1000),
    source        varchar(10)    NOT NULL,
    created_at    timestamptz    NOT NULL,
    updated_at    timestamptz    NOT NULL,
    CONSTRAINT food_meal_chk CHECK (meal IN ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER')),
    CONSTRAINT food_source_chk CHECK (source IN ('MANUAL', 'SCANNER'))
);
CREATE INDEX idx_food_entries_user_date ON food_entries (user_id, entry_date);

CREATE TABLE weight_logs (
    id         uuid PRIMARY KEY,
    user_id    uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    log_date   date          NOT NULL,
    weight_kg  numeric(6, 2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
    note       varchar(500),
    created_at timestamptz   NOT NULL,
    updated_at timestamptz   NOT NULL
);
CREATE INDEX idx_weight_logs_user_date ON weight_logs (user_id, log_date);

CREATE TABLE workout_sessions (
    id                 uuid PRIMARY KEY,
    user_id            uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_date       date          NOT NULL,
    workout_type       varchar(10)   NOT NULL,
    name               varchar(120)  NOT NULL,
    duration_minutes   integer       NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
    estimated_calories integer       CHECK (estimated_calories BETWEEN 0 AND 20000),  -- an ESTIMATE, separate from food intake
    notes              varchar(1000),
    split              varchar(20),
    cardio_type        varchar(20),
    distance_km        numeric(8, 2) CHECK (distance_km BETWEEN 0 AND 1000),
    created_at         timestamptz   NOT NULL,
    updated_at         timestamptz   NOT NULL,
    CONSTRAINT workout_type_chk CHECK (workout_type IN ('STRENGTH', 'CARDIO')),
    CONSTRAINT workout_split_chk CHECK (split IS NULL OR split IN ('CHEST_TRICEPS', 'BACK_BICEPS', 'LEGS', 'FULL_BODY', 'CUSTOM')),
    CONSTRAINT workout_cardio_chk CHECK (cardio_type IS NULL OR cardio_type IN ('RUNNING', 'WALKING', 'CYCLING', 'SWIMMING', 'OTHER')),
    CONSTRAINT workout_shape_chk CHECK (
        (workout_type = 'STRENGTH' AND split IS NOT NULL AND cardio_type IS NULL AND distance_km IS NULL) OR
        (workout_type = 'CARDIO' AND cardio_type IS NOT NULL AND split IS NULL))
);
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions (user_id, session_date);

-- Exercises are owned through their session (and therefore the session's user); deleting the session or user cascades.
CREATE TABLE workout_exercises (
    id         uuid PRIMARY KEY,
    session_id uuid          NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
    sort_order integer       NOT NULL,
    name       varchar(120)  NOT NULL,
    sets       integer       NOT NULL CHECK (sets BETWEEN 1 AND 100),
    reps       integer       NOT NULL CHECK (reps BETWEEN 1 AND 1000),
    weight_kg  numeric(7, 2) NOT NULL CHECK (weight_kg BETWEEN 0 AND 1000),
    notes      varchar(500)
);
CREATE INDEX idx_workout_exercises_session ON workout_exercises (session_id);
