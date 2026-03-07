# IronForge - Workout Generator App

## Overview

IronForge is a React Native mobile application built with Expo that generates workout routines across four major categories: Weight Lifting (traditional splits with strength/hypertrophy styles), Circuit Training (AMRAP, EMOM, Rounds for Time, Hyrox simulation), Yoga (core strength or flexibility routines), and Cardio (running or mixed cardio). Users select a category, pick sub-options specific to that category, set a duration (30/45/60/90 min), and get a generated workout plan. Workouts are saved locally and can be viewed/deleted in a history tab. The app has a dark-themed UI with category-specific accent colors and uses the Rubik font family.

The project follows a full-stack architecture with an Express backend server and an Expo/React Native frontend, designed to run on Replit with support for iOS, Android, and web platforms.

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
- **Styling**: Dark theme with StyleSheet-based styling; colors defined in `constants/colors.ts`
- **Error Handling**: Class-based ErrorBoundary component wrapping the app

### Backend (Express Server)

- **Framework**: Express 5 running on Node.js
- **Location**: `server/` directory with `index.ts` (entry point), `routes.ts` (API route registration), and `storage.ts` (data access layer)
- **Storage Pattern**: Interface-based storage (`IStorage`) with an in-memory implementation (`MemStorage`). Currently only has user CRUD operations. The storage interface is designed to be swapped out for a database-backed implementation.
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost for development
- **Static Serving**: In production, serves a static web build; in development, proxies to Metro bundler

### Database Schema

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` — shared between frontend and backend
- **Current Tables**: `users` table with `id` (UUID, auto-generated), `username` (unique text), and `password` (text)
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Output to `./migrations` directory; push with `npm run db:push`
- **Note**: The database requires a `DATABASE_URL` environment variable. Workout data is currently stored client-side in AsyncStorage, not in the database.

### Workout Generation

- Workout generation logic lives entirely on the client side in `lib/exercises.ts`
- Exercises are categorized by muscle group, equipment, and category (compound/isolation)
- The `generateWorkout()` function creates workout plans based on selected type, style, and duration
- Generated workouts are saved to AsyncStorage and displayed in the history tab
- Per-exercise refresh button swaps a single exercise for another from the same pool (`findReplacementExercise`)
- Weight Lifting supports supersets: 1 pair for 30/45 min, 2 pairs for 60/90 min (core exercise excluded from superset pairing)
- Weight Lifting supports a "Core" toggle: when enabled, the last exercise is replaced with an ab exercise; refreshing uses `findCoreReplacementExercise` from the abs pool
- Supersets and Core tiles are displayed side-by-side at half width on the generate screen
- EMOM and Rounds for Time circuits support "More Movements" / "More Rounds" balance toggles in the hero card
- `rebalanceCircuit()` adjusts exercise count and round count based on selected balance and duration
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