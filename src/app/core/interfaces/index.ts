// Re-export all interfaces and injection tokens from this directory
export * from './auth.interface';
export * from './threat-model.interface';
export * from './collaboration-notification.interface';

// Injection tokens
import { InjectionToken } from '@angular/core';
import { IAuthService } from './auth.interface';
import { IThreatModelService } from './threat-model.interface';

export const AUTH_SERVICE = new InjectionToken<IAuthService>('AUTH_SERVICE');
export const THREAT_MODEL_SERVICE = new InjectionToken<IThreatModelService>('THREAT_MODEL_SERVICE');