import '@angular/compiler';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { of, throwError, lastValueFrom } from 'rxjs';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let api: { get: ReturnType<typeof vi.fn>; getBlob: ReturnType<typeof vi.fn> };
  let logger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { get: vi.fn(), getBlob: vi.fn() };
    logger = { debug: vi.fn(), info: vi.fn(), error: vi.fn() };
    service = new AdminAuditService(api as never, logger as never);
  });

  it('lists system entries, passing filter + page params, dropping empties', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50, next_cursor: null }));
    await lastValueFrom(
      service.listSystem(
        { actor_email: 'a@b.c', http_method: 'PUT', path_prefix: '' },
        { limit: 50, cursor: 'X' },
      ),
    );
    expect(api.get).toHaveBeenCalledWith('admin/audit/system', {
      actor_email: 'a@b.c',
      http_method: 'PUT',
      limit: 50,
      cursor: 'X',
    });
  });

  it('lists system entries in around mode', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50 }));
    await lastValueFrom(service.listSystem({}, { limit: 50, around: 'uuid-1' }));
    expect(api.get).toHaveBeenCalledWith('admin/audit/system', { limit: 50, around: 'uuid-1' });
  });

  it('gets a single system entry by id', async () => {
    api.get.mockReturnValue(of({ id: 'e1' }));
    await lastValueFrom(service.getSystemEntry('e1'));
    expect(api.get).toHaveBeenCalledWith('admin/audit/system/e1');
  });

  it('lists TM entries against the threat_models endpoint', async () => {
    api.get.mockReturnValue(of({ entries: [], total: 0, limit: 50 }));
    await lastValueFrom(service.listTm({ object_type: 'threat' }, { limit: 50 }));
    expect(api.get).toHaveBeenCalledWith('admin/audit/threat_models', {
      object_type: 'threat',
      limit: 50,
    });
  });

  it('gets a single TM entry by id', async () => {
    api.get.mockReturnValue(of({ id: 't1' }));
    await lastValueFrom(service.getTmEntry('t1'));
    expect(api.get).toHaveBeenCalledWith('admin/audit/threat_models/t1');
  });

  it('exports system audit as a blob with format param', async () => {
    api.getBlob.mockReturnValue(of(new Blob(['x'])));
    await lastValueFrom(service.exportSystem({ actor_email: 'a@b.c' }, 'ndjson'));
    expect(api.getBlob).toHaveBeenCalledWith('admin/audit/system', {
      actor_email: 'a@b.c',
      format: 'ndjson',
    });
  });

  it('logs and rethrows on list error', async () => {
    api.get.mockReturnValue(throwError(() => new Error('boom')));
    await expect(lastValueFrom(service.listSystem({}, {}))).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
