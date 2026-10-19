# API contract (v1) — base path `/api/v1`

All JSON is camelCase. Enum values are **lower-case snake_case** strings (parsing is case-insensitive).
IDs are UUID strings. Dates are `YYYY-MM-DD`. Timestamps are ISO-8601 UTC.

## Assumptions about the frontend (verify against `src/types/index.ts`)
The frontend source was not available. Adjust the enums in `backend/.../common/*.java` (and the SQL CHECK constraints in V1) if yours differ.

| Concept | Values used here |
|---|---|
| meal | breakfast, lunch, snacks, dinner |
| source | manual, scanner |
| biologicalSex | male, female, unspecified |
| activityLevel | sedentary, light, moderate, active, very_active |
| goalType | lose_weight, maintain, gain_weight, build_muscle |
| weightUnit / heightUnit | kg, lbs / cm, ft_in |
| workout `type` (discriminator) | strength, cardio |
| split | chest_triceps, back_biceps, legs, full_body, custom |
| cardioType | running, walking, cycling, swimming, other |
| list endpoints | paged `{items,page,size,totalElements,totalPages}` (food-entries, workouts, weights); goals returns a plain array |
| exercise ids | server-assigned; ids sent by the client are ignored and may change when a workout is edited |

## Endpoints
| Area | Endpoints |
|---|---|
| Auth | POST `/auth/register` `/auth/login` `/auth/refresh` `/auth/logout`; GET `/auth/me`; PUT `/auth/password`; DELETE `/auth/account` |
| Profile | GET/PUT `/profile` |
| Nutrition | GET `/nutrition/estimate`; GET `/nutrition/daily-summary?date=` |
| Goals | GET/POST `/goals`; GET `/goals/active?date=`; GET/PUT/DELETE `/goals/{id}` |
| Food | GET `/food-entries?date=` or `?from=&to=&page=&size=`; POST; GET/PUT/DELETE `/{id}`; POST `/{id}/duplicate`; GET `/summary?date=` or `?from=&to=` |
| Scanner | POST `/scanner/analyze` (multipart `image`, `description`); POST `/scanner/text-estimate` |
| Workouts | GET `?date=` or `?from=&to=`; POST; GET/PUT/DELETE `/{id}` |
| Weights | GET `?from=&to=`; POST; PUT/DELETE `/{id}` |
| Analytics | GET `/analytics/daily?date=`, `/weekly?from=&to=` (≤31 days), `/monthly?year=&month=`, `/yearly?year=` |

## Status codes
200/201/204 success · 400 validation (`fieldErrors`) · 401 unauthenticated · 403 forbidden (e.g. missing CSRF header) · 404 missing *or not yours* · 409 conflict (duplicate email, goal date rules) · 413 oversized upload · 415 unsupported media type · 429 rate limited · 503 scanner provider unavailable/failed.

## Key payloads
FoodEntry: `{id,date,meal,name,quantity,unit,nutrition:{calories,protein,carbohydrates,fat,fiber},notes,source,createdAt,updatedAt}`
Goal: `{id,effectiveFrom,goalType,dailyCalories,protein,carbohydrates,fat,fiber,targetWeightKg}`
Weight: `{id,date,weightKg,note}`
Workout (strength): `{id,type:"strength",date,name,durationMinutes,estimatedCalories,caloriesAreEstimate:true,notes,split,exercises:[{id,name,sets,reps,weightKg,notes}]}`
Workout (cardio): `{…,type:"cardio",cardioType,distanceKm}`
Scan: `{analysisId,isEstimate:true,provider,disclaimer,items:[{name,quantity,servingUnit,servingAmount,servings,nutritionPerServing,estimatedNutrition,confidence,uncertainty[],warnings[]}],warnings[]}`
Estimate: `{age,estimatedBmr,activityMultiplier,estimatedMaintenanceCalories,goalType,suggestedCalorieTarget,suggestedMacros,formula,biologicalSexHandling,isEstimate,notes[]}`
