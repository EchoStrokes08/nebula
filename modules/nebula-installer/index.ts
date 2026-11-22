import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type InstallStatus = 'success' | 'pendingUserAction' | 'aborted' | 'failure';
export interface InstallStatusEvent { status: InstallStatus; message: string | null }

interface NebulaInstallerNative {
  installerOfRecord(): string | null;
  canInstallSilently(): boolean;
  install(path: string): Promise<void>;
  addListener(event: 'onStatus', listener: (e: InstallStatusEvent) => void): EventSubscription;
}

/** Módulo nativo de Android (modules/nebula-installer). null en la web, el escritorio, los tests y APKs antiguos. */
export const NebulaInstaller = requireOptionalNativeModule<NebulaInstallerNative>('NebulaInstaller');
