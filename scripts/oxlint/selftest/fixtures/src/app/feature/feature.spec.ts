import { ProbeService } from '@app/shared/probe.service';

export function specHelpers(service: ProbeService): unknown[] {
  service.run();
  const loose: any = { a: 1 };
  const cast = loose as any;
  const nested = [loose] as Array<any>;
  const asserted = <any>loose;
  const ok = loose as unknown as ProbeService;
  return [cast, nested, asserted, ok];
}
