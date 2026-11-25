import * as Crypto from 'expo-crypto';
import { createCircuitController } from './circuit-controller';
import { editWorkout, getLocalWorkoutsOnly } from './workout-storage';
import { circuitChime, cancelCircuitNotifications, scheduleCircuitNotifications, continuousCircuitMilliseconds } from './run-audio';
const runtime = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const circuitClock = () => {
  const wall = Date.now(), continuous = continuousCircuitMilliseconds();
  const source = continuous === null ? 'wall' as const : 'continuous' as const;
  return { wall, mono: continuous ?? wall, runtime: `${runtime}:${source}`, source };
};
export const circuitController = createCircuitController({ load: getLocalWorkoutsOnly, edit: editWorkout,
  clock: circuitClock, id: Crypto.randomUUID, chime: circuitChime.play, stopChime: circuitChime.stop,
  schedule: scheduleCircuitNotifications, cancelScheduled: cancelCircuitNotifications });
