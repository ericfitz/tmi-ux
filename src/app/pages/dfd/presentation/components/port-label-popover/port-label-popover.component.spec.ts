import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElementRef } from '@angular/core';
import {
  PortLabelPopoverComponent,
  DEFAULT_PORT_LABEL_POSITION,
  PortLabelPosition,
} from './port-label-popover.component';

describe('PortLabelPopoverComponent', () => {
  let component: PortLabelPopoverComponent;
  let mockElementRef: ElementRef;

  beforeEach(() => {
    const mockElement = document.createElement('div');
    mockElementRef = { nativeElement: mockElement } as ElementRef;
    component = new PortLabelPopoverComponent(mockElementRef);
  });

  afterEach(() => {
    // Clean up document listeners
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default port label data', () => {
    component.ngOnInit();
    expect(component.labelText).toBe('');
    expect(component.labelPosition).toBe(DEFAULT_PORT_LABEL_POSITION);
  });

  it('should initialize with provided port label data', () => {
    component.portLabel = {
      nodeId: 'node-1',
      portId: 'top',
      text: 'HTTP',
      position: 'inside',
    };
    component.ngOnInit();

    expect(component.labelText).toBe('HTTP');
    expect(component.labelPosition).toBe('inside');
  });

  it('should emit labelChanged when text changes', () => {
    component.portLabel = {
      nodeId: 'node-1',
      portId: 'top',
      text: '',
      position: 'outside',
    };
    component.ngOnInit();

    const spy = vi.fn();
    component.labelChanged.subscribe(spy);

    component.onTextChange('New Label');

    expect(spy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      portId: 'top',
      text: 'New Label',
      position: 'outside',
    });
  });

  it('should emit labelChanged when position changes', () => {
    component.portLabel = {
      nodeId: 'node-1',
      portId: 'right',
      text: 'Data',
      position: 'outside',
    };
    component.ngOnInit();

    const spy = vi.fn();
    component.labelChanged.subscribe(spy);

    component.onPositionChange('left');

    expect(spy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      portId: 'right',
      text: 'Data',
      position: 'left',
    });
  });

  it('should emit closed when close is called', () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);

    component.close();

    expect(spy).toHaveBeenCalled();
  });

  it('should support all six position options', () => {
    const positions: PortLabelPosition[] = ['outside', 'inside', 'top', 'bottom', 'left', 'right'];
    const spy = vi.fn();
    component.labelChanged.subscribe(spy);

    component.portLabel = { nodeId: 'n', portId: 'p', text: 'x', position: 'outside' };
    component.ngOnInit();

    for (const pos of positions) {
      component.onPositionChange(pos);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ position: pos }));
    }
    expect(spy).toHaveBeenCalledTimes(positions.length);
  });

  it('should update both text and position independently', () => {
    component.portLabel = {
      nodeId: 'node-1',
      portId: 'top',
      text: 'Original',
      position: 'outside',
    };
    component.ngOnInit();

    const spy = vi.fn();
    component.labelChanged.subscribe(spy);

    component.onTextChange('Updated');
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Updated', position: 'outside' }),
    );

    component.onPositionChange('inside');
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Updated', position: 'inside' }),
    );
  });
});
