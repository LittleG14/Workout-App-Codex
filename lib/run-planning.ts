import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRunPlanningRepository } from './run-planning-repository';
export const runPlanning = createRunPlanningRepository(AsyncStorage);
