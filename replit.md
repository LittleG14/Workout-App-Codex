# IronForge - Workout Generator App

## Overview

IronForge is a React Native mobile application built with Expo that generates workout routines. Users can select workout types (chest & triceps, back & biceps, legs, push, pull, full body, etc.), choose a training style (strength or hypertrophy), set a duration, and get a generated workout plan. Workouts are saved locally and can be viewed in a history tab. The app has a dark-themed UI with orange accent colors and uses the Rubik font family.

The project follows a full-stack architecture with an Express backend server and an Expo/React Native frontend, designed to run on Replit with support for iOS, Android, and web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Tab-based layout with two main tabs — "Generate" (workout creation) and "History" (saved workouts). A detail screen at `workout/[id]` shows individual workout details.
- **State Management**: TanStack React Query for server state; React's built-in useState for local UI state
- **Animations**: react-native-reanimated for smooth animations (fade-ins, swipe-to-delete gestures in history)
- **Gesture Handling**: react-native-gesture-handler for swipeable list items
- **Fonts**: Rubik font family (Regular, Medium, SemiBold, Bold) loaded via @expo-google-fonts
- **Local Storage**: AsyncStorage for persisting generated workouts on-device (see `lib/workout-storage.ts`)
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