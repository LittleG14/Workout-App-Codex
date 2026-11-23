import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { createRunAudioQueue } from './run-milestones';
interface RunAudioModule { prepareAsync(): Promise<void>; playAsync(kind: string, text: string): Promise<void>; stopAsync(): Promise<void> }
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<RunAudioModule>('SwoleRunAudio') : null;
export const runAudioAvailable = !!native;
export async function prepareRunAudio() { if (native) await native.prepareAsync(); }
export const runAudio = createRunAudioQueue({
  play: async (event, text) => {
    if (!native) throw new Error('Audio milestones require the new iOS native build. Visual milestones remain available.');
    await native.playAsync(event.type, text);
  },
  stop: () => { if (native) void native.stopAsync().catch(() => {}); },
});
