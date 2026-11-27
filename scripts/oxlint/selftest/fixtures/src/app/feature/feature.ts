import { readFileSync, existsSync } from './fs-shim';
import { ProbeService } from '@app/shared/probe.service';
import { LegacyModule } from './legacy.module';
import { MatButton } from '@angular/material';

export function feature(service: ProbeService, _ignored: number): string {
  service.run();
  console.log('not allowed');
  console.warn('allowed');
  try {
    return readFileSync('x');
  } catch (err) {
    return String(LegacyModule) + String(MatButton);
  }
}

// oxlint-disable-next-line no-debugger
export const unusedDirective = 1;
