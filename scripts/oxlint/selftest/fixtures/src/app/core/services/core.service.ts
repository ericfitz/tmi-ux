import { AuthThing } from '../../auth/services/auth';
import { Thing } from '../../pages/thing';
import { DeepPage } from '../../pages/tm/components/deep/deep.component';
import { DeepAuth } from '../../auth/services/sub/auth';
import { AuthComponent } from '../../auth/components/login';
import { NearPage } from '../pages/near';
import { NearAuth } from '../auth/near';
import { LegacyModule } from '../../feature/legacy.module';

export const core = [
  AuthThing,
  Thing,
  DeepPage,
  DeepAuth,
  AuthComponent,
  NearPage,
  NearAuth,
  LegacyModule,
];
