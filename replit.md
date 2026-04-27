# Swole House - Workout Generator App

## Overview

Swole House is a React Native mobile application built with Expo that generates workout routines across five major categories: Weight Lifting (traditional splits with strength/hypertrophy styles), Circuit Training (AMRAP, EMOM, Rounds for Time, Hyrox simulation), Yoga (core strength or flexibility routines), Cardio (running or mixed cardio), and Mobility (full body/lower body/upper body/hips & spine routines with a cyan color scheme). Users select a category, pick sub-options specific to that category, set a duration, and get a generated workout plan. Mobility uses its own duration options (10/20/30/45 min) while all other categories use 30/45/60/90 min. Workouts are saved locally and can be viewed/deleted in a history tab. The app has a dark-themed UI with category-specific accent colors and uses the Rubik font family.

The project follows a full-stack architecture with an Express backend server and an Expo/React Native frontend, designed to run on Replit with support for iOS, Android, and web platforms. The app includes a complete authentication system (email/password, Google, and Apple sign-in) with JWT tokens stored in the device keychain (expo-secure-store) for persistent sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Tab-based layout with three main tabs — "Generate" (workout creation), "History" (saved workouts), and "Profile" (user data & PRs). A detail screen at `workout/[id]` shows individual workout details.
- **State Management**: TanStack React Query for server state; React's built-in useState for local UI state
- **Animations**: react-native-reanimated for smooth animations (fade-ins, swipe-to-delete gestures in history)
- **Gesture Handling**: react-native-gesture-handler for swipeable list items
- **Fonts**: Rubik font family (Regular, Medium, SemiBold, Bold) loaded via @expo-google-fonts
- **Local Storage**: AsyncStorage for persisting generated workouts (`lib/workout-storage.ts`) and user profile (`lib/profile-storage.ts`)
- **Supabase Client**: `lib/supabase.ts` — creates the Supabase client with a chunked `expo-secure-store` adapter (handles iOS 2048-byte key limit for large session tokens). Used by `lib/auth-storage.ts` and `contexts/AuthContext.tsx`.
- **Auth Context**: `contexts/AuthContext.tsx` provides `login`, `register`, `logout`, and `user` state. Listens to `supabase.auth.onAuthStateChange` for session changes. User name is stored in Supabase `user_metadata.name` at sign-up.
- **Styling**: Dark theme with StyleSheet-based styling; colors defined in `constants/colors.ts`
- **Error Handling**: Class-based ErrorBoundary component wrapping the app

### Authentication

- **Provider**: Supabase Auth (`@supabase/supabase-js`) — email/password only. Google and Apple can be added later via Supabase dashboard.
- **Auth screens**: `app/(auth)/index.tsx` (sign in) and `app/(auth)/signup.tsx` (registration). Clean email-only UI — no social login buttons.
- **Routing guard**: `app/(tabs)/_layout.tsx` redirects to `/(auth)` if `user` is null; `app/index.tsx` redirects to `/(tabs)` or `/(auth)` based on auth state.
- **Session storage**: Supabase SDK manages tokens automatically via the chunked SecureStore adapter in `lib/supabase.ts`.
- **`lib/auth-storage.ts`**: Thin wrapper — `getToken()` reads the current Supabase access token from the session; `clearAllAuth()` calls `supabase.auth.signOut()`.
- **Server-side validation**: `server/auth.ts` creates a server-side Supabase client (no session persistence) and validates Bearer tokens in `authMiddleware` using `supabase.auth.getUser(token)`.
- **No custom auth endpoints**: All `/api/auth/*` routes removed. Supabase handles sign-up, sign-in, and sign-out entirely client-side.
- **Sign-out UI**: Inline two-step confirmation — first press shows "Sign out of IronForge?" with Cancel + Sign Out buttons inline.
- **Required env vars**: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) — set as secrets. Used by both client and server.
- **Email confirmation**: Disabled by default in new Supabase projects. If enabled, the signup screen shows a "Check Your Email" dialog and redirects back to sign in.
- **Note**: Workouts are stored in Supabase PostgreSQL via `DbStorage`. The `SUPABASE_CONNECTION_STRING` secret must be the Transaction Pooler URL (port 6543).

### Backend (Express Server)

- **Framework**: Express 5 running on Node.js
- **Location**: `server/` directory with `index.ts` (entry point), `routes.ts` (API route registration), `auth.ts` (JWT/bcrypt utilities), and `storage.ts` (data access layer)
- **Storage Pattern**: Interface-based storage (`IStorage`) with an in-memory implementation (`MemStorage`). The storage interface is designed to be swapped out for a database-backed implementation.
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost for development
- **Static Serving**: In production, serves a static web build; in development, proxies to Metro bundler

### Database Schema

- **ORM**: Drizzle ORM with PostgreSQL dialect, using the `postgres` npm package as the driver
- **Schema Location**: `shared/schema.ts` — shared between frontend and backend
- **Tables**: `workouts` only (id, user_id TEXT, name, top_category, data JSON text, created_at). No `users` table — Supabase Auth manages user identity.
- **`workouts.user_id`**: Stores the Supabase Auth user UUID (no FK constraint — Supabase `auth.users` is in a different schema).
- **Migrations**: Run `tsx scripts/migrate.ts` to create/update tables (bypasses drizzle-kit due to Supabase password encoding). The migration also drops the old FK constraint and users table if present.
- **Connection**: Requires `SUPABASE_CONNECTION_STRING` set to the **Transaction Pooler** URL (port 6543) from the Supabase dashboard. Passwords with special characters are URL-encoded automatically in `server/db.ts`.
- **Workout Storage**: Full `GeneratedWorkout` JSON stored in `workouts.data` text column. Frontend syncs to server on save/update/delete; local AsyncStorage used as fast cache.

### Workout Generation

- Workout generation logic lives entirely on the client side in `lib/exercises.ts`
- Exercises are categorized by muscle group, equipment, and category (compound/isolation)
- The `generateWorkout()` function creates workout plans based on selected type, style, and duration
- Generated workouts are saved to AsyncStorage and displayed in the history tab
- Per-exercise refresh button swaps a single exercise for another from the same pool (`findReplacementExercise`)
- Weight Lifting supports supersets: 1 pair for 30/45 min, 2 pairs for 60/90 min (core exercise excluded from superset pairing)
- Weight Lifting supports a "Core" toggle: when enabled, the last exercise is replaced with an ab exercise; refreshing uses `findCoreReplacementExercise` from the abs pool
- Supersets and Core tiles are displayed side-by-side at half width on the generate screen
- AMRAP and EMOM circuits at 60/90 min are split into 2 separate circuit blocks with different exercises and independent time caps
- EMOM and Rounds for Time circuits support "More Movements" / "More Rounds" balance toggles in the hero card
- `rebalanceCircuit()` adjusts exercise count and round count based on selected balance and duration; supports multi-block circuits
- Balance preference is persisted to `GeneratedWorkout.circuitBalance` via AsyncStorage

### Weight Logging

- Weight Lifting and Circuit exercises have a weight logging icon (paper+plus) on each exercise card
- Tapping opens a modal dialog to enter weight used (numeric input with lbs/kg toggle)
- Logged weight is saved to `WorkoutExercise.weight` and `WorkoutExercise.weightUnit` fields
- Weight persists to AsyncStorage via `updateWorkout()` and is visible in workout history
- Works on regular exercises, superset exercises (A/B), and circuit block exercises
- Once logged, the icon is replaced by a colored badge showing the weight (e.g., "135 lbs")

### Notes Logging

- Yoga and Cardio exercises have a notes logging icon (paper+plus) on each exercise card
- Tapping opens a modal dialog with a multiline text input for free-form notes
- Logged notes are saved to `WorkoutExercise.userNotes` field
- Notes persist to AsyncStorage via `updateWorkout()` and are displayed inline below the exercise card
- Once logged, the icon is replaced by a colored badge showing "Notes ✓"

### Mobility Category

- Mobility sub-types: `full_body`, `lower_body`, `upper_body`, `hips_and_spine` — displayed as scrollable tiles (like Weight Lifting muscle group selector)
- Duration options: `[10, 20, 30, 45]` min — different from other categories' `[30, 45, 60, 90]`
- Duration resets automatically when switching to/from Mobility (20 min default for mobility, 45 min for others)
- Accent color: `#06B6D4` (cyan) defined as `Colors.mobility`
- Exercises show notes log (like Yoga/Cardio), not weight log
- `MOBILITY_EXERCISES` (24 exercises) and `MOBILITY_EXERCISES_BY_SUBTYPE` (sub-type pools) in `lib/exercises.ts`
- PRs & Last modal has a "Mobility" tab showing last-performed date + last note (same as Yoga/Cardio view)

### BMR Estimation

- Profile tab shows an estimated BMR card between the Goal section and the PRs button
- Uses the Mifflin-St Jeor equation with gender-specific constants: Male (+5), Female (-161), N/A (-78)
- Converts imperial inputs to metric before calculation: lbs→kg (×0.453592), ft/in→cm (×2.54)
- Requires gender, height, weight, and age to display a result; shows placeholder text if any are missing

### PRs & Last Modal (Profile Tab)

- Profile tab has a "PRs and Last" button that opens a modal with 4 category tabs: Weights, Circuit, Yoga, Cardio
- Weights/Circuit tabs show exercise lists with PR weight badges and detail views showing Personal Record (trophy) and Last Performed stats
- Yoga/Cardio tabs show exercise lists with last-performed date badges and detail views showing Last Performed date and Last Note (saved user notes)
- The `computePRs` function in `profile.tsx` supports all 4 categories, tracking `lastNotes` for yoga/cardio

### Contact Us & Feedback

- Fourth tab "Contact" (mail icon) to the right of Profile in the bottom bar
- Full-screen landing with a "Send Feedback" button that opens a `pageSheet` modal
- Three feedback types with different form behaviour:
  - **Exercise Request**: Category = one of 5 workout categories (Weights/Circuit/Yoga/Cardio/Mobility); Submission capped at 40 characters
  - **App Functionality**: Category = Workout Structure / Feature Problems / Profile Issues; Submission unlimited
  - **General Feedback**: Category auto-filled as "General Feedback" (no dropdown); Submission unlimited
- On submit, `POST /api/feedback` is called (auth-protected); server timestamps and inserts into the `feedback` Supabase table
- Success state replaces the form with a thank-you screen; errors surface inline
- **`feedback` table** (Supabase PostgreSQL): `id TEXT PK`, `user_id TEXT`, `date TEXT` (ISO), `selection TEXT`, `category TEXT`, `submission TEXT`
- Schema in `shared/schema.ts`; migration via `tsx scripts/migrate.ts`; route in `server/routes.ts`; storage method `saveFeedback` in `server/storage.ts`
- Screen: `app/(tabs)/contact.tsx`; tab registration in `app/(tabs)/_layout.tsx`

### Build & Development

- **Dev Mode**: Two processes — `expo:dev` for the Expo bundler and `server:dev` for the Express API
- **Production Build**: Static web export via custom build script (`scripts/build.js`) + bundled server via esbuild
- **Path Aliases**: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

## External Dependencies

### Core Services
- **PostgreSQL**: Database (requires `DATABASE_URL` environment variable), used via Drizzle ORM
- **Replit**: Hosting platform with domain configuration via `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, and `REPLIT_INTERNAL_APP_DOMAIN` environment variables

### Key Libraries
- **Expo SDK 54**: Core mobile framework with plugins for router, fonts, web-browser
- **Express 5**: Backend HTTP server
- **Drizzle ORM + drizzle-zod**: Database ORM and schema validation
- **TanStack React Query**: Server state management and API data fetching
- **AsyncStorage**: Local key-value storage for workout persistence
- **react-native-reanimated**: Animations
- **react-native-gesture-handler**: Touch gesture support
- **expo-haptics**: Haptic feedback on interactions
- **expo-linear-gradient**: Gradient UI elements
- **expo-blur**: Blurred tab bar background on iOS
- **patch-package**: Applied via postinstall for dependency patches