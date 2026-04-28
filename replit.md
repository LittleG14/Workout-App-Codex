# Swole House - Workout Generator App

## Overview

Swole House is a React Native mobile application built with Expo that generates diverse workout routines across five main categories: Weight Lifting, Circuit Training, Yoga, Cardio, and Mobility. Users can select a category, specific sub-options, and a duration to receive a tailored workout plan. Generated workouts are saved locally for history tracking. The app features a dark-themed UI with category-specific accent colors and a complete authentication system supporting email/password, Google, and Apple sign-in, with JWT tokens for persistent sessions. It is designed for iOS, Android, and web platforms, running on Replit with an Express backend and Expo/React Native frontend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with `expo-router` for file-based routing.
- **Navigation**: Tab-based layout with "Generate", "History", and "Profile" tabs.
- **State Management**: TanStack React Query for server state; React's `useState` for local UI state.
- **Animations**: `react-native-reanimated` for smooth UI animations.
- **Styling**: Dark theme with StyleSheet-based styling and `Rubik` font family.
- **Local Storage**: AsyncStorage for persisting workouts and user profiles.
- **Authentication**: `AuthContext.tsx` manages user sessions via Supabase and `expo-secure-store`.

### Backend (Express Server)

- **Framework**: Express 5 running on Node.js.
- **Architecture**: Interface-based storage (`IStorage`) with an in-memory implementation for flexibility.
- **CORS**: Dynamic CORS configuration for development and production environments.
- **API**: Handles authentication validation, feedback submission, and admin functionalities.

### Database Schema

- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `workouts` table between frontend and backend, storing `GeneratedWorkout` JSON.
- **Migrations**: Custom migration script (`scripts/migrate.ts`) for Supabase PostgreSQL.

### Authentication

- **Provider**: Supabase Auth handles email/password sign-in/up.
- **Session Management**: Supabase SDK manages tokens via a chunked `SecureStore` adapter.
- **Server-side Validation**: Express backend validates Bearer tokens using Supabase.
- **Account Management**: Users can tap their name card on the Profile tab to access an Account Settings sheet. Supports changing email (sends Supabase confirmation email), changing password (re-authenticates first), and deleting account (server-side via `SUPABASE_SERVICE_ROLE_KEY` + `DELETE /api/account`).

### Environment Secrets
- `SUPABASE_SERVICE_ROLE_KEY`: Required for server-side account deletion via Supabase Admin API.

### Workout Generation

- **Client-side Logic**: All workout generation is performed client-side in `lib/exercises.ts`.
- **Customization**: Supports various workout types, styles, durations, and exercise replacement.
- **Features**: Includes supersets, core exercises toggle, and circuit rebalancing based on user preferences.

### Logging Features

- **Weight Logging**: Allows users to log weights for Weight Lifting and Circuit exercises.
- **Notes Logging**: Enables users to add notes for Yoga, Cardio, and Mobility exercises.

### Mobility Category

- **Specifics**: Unique sub-types, duration options, and accent color (`#06B6D4`).
- **Exercise Pool**: Dedicated mobility exercises and subtype pools.

### BMR Estimation

- **Functionality**: Estimates Basal Metabolic Rate on the Profile tab using the Mifflin-St Jeor equation.

### PRs & Last Modal

- **Tracking**: Displays Personal Records (PRs) and last-performed stats for various exercise categories.

### Admin Screen

- **Access**: Accessible via the Profile tab, with backend enforcement based on `ADMIN_EMAILS`.
- **Features**: Provides tools to check email domain status, verify DNS, and send test emails.

### Contact Us & Feedback

- **Functionality**: Dedicated tab for submitting feedback through a modal form.
- **Feedback Types**: Supports Exercise Request, App Functionality, and General Feedback.
- **Confirmation**: Sends an HTML confirmation email to the user via Resend after submission.

## External Dependencies

### Core Services
- **PostgreSQL**: Database for persistent storage.
- **Replit**: Hosting platform.
- **Supabase**: Authentication and database services.
- **Resend**: Email delivery service for transactional emails.

### Key Libraries
- **Expo SDK 54**: Core framework.
- **Express 5**: Backend server.
- **Drizzle ORM + drizzle-zod**: Database ORM and schema validation.
- **TanStack React Query**: Server state management.
- **AsyncStorage**: Local storage.
- **react-native-reanimated**: Animations.
- **react-native-gesture-handler**: Gesture handling.
- **expo-haptics**: Haptic feedback.
- **expo-linear-gradient**: Gradient UI elements.
- **expo-blur**: Blurred UI effects.