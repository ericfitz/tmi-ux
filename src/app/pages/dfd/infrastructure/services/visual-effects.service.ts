import { Injectable } from '@angular/core';
import { Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Interface for tracking active visual effects
 */
interface ActiveEffect {
  timer: any;
  cell: Cell;
  effectType: 'creation' | 'pulse';
  startTime: number;
}

/**
 * Visual Effects Service
 * Manages creation highlights, pulse effects, and fade-out animations for programmatically created nodes and edges
 * Uses the same styling techniques as hover/selection effects but with light blue coloring
 */
@Injectable({
  providedIn: 'root',
})
export class VisualEffectsService {
  private readonly CREATION_DURATION_MS = 1000;
  private readonly PULSE_DURATION_MS = 600;
  private readonly ANIMATION_FRAME_INTERVAL = 16; // ~60fps

  // Track active effects to prevent conflicts and memory leaks
  private activeEffects = new Map<string, ActiveEffect>();

  constructor(private logger: LoggerService) {}

  /**
   * Apply creation highlight with fade-out effect to a newly created cell
   * Includes both glow effect and pulse animation
   */
  applyCreationHighlight(cell: Cell): void {
    if (!cell) {
      this.logger.warn('[VisualEffects] Cannot apply creation highlight to null cell');
      return;
    }

    // Don't apply if cell already has an active effect or is selected
    if (this.activeEffects.has(cell.id) || this.isCellSelected(cell)) {
      this.logger.debug(
        '[VisualEffects] Skipping creation highlight - cell has existing effect or is selected',
        {
          cellId: cell.id,
        },
      );
      return;
    }

    this.logger.info('[VisualEffects] Applying creation highlight', {
      cellId: cell.id,
      cellType: cell.isNode() ? 'node' : 'edge',
    });

    try {
      // Apply initial bright blue highlight
      this.applyInitialCreationEffect(cell);

      // Start pulse animation
      this.startPulseAnimation(cell);

      // Start fade-out animation after pulse completes
      setTimeout(() => {
        if (this.activeEffects.has(cell.id)) {
          this.startFadeOutAnimation(cell);
        }
      }, this.PULSE_DURATION_MS);
    } catch (error) {
      this.logger.error('[VisualEffects] Error applying creation highlight', {
        cellId: cell.id,
        error,
      });
    }
  }

  /**
   * Remove any active visual effects from a cell
   */
  removeVisualEffects(cell: Cell): void {
    if (!cell) return;

    const activeEffect = this.activeEffects.get(cell.id);
    if (activeEffect) {
      // Clear animation timer
      if (activeEffect.timer) {
        clearInterval(activeEffect.timer);
      }

      // Remove visual effects
      this.removeAllEffectsFromCell(cell);

      // Clean up tracking
      this.activeEffects.delete(cell.id);

      this.logger.debug('[VisualEffects] Removed visual effects', { cellId: cell.id });
    }
  }

  /**
   * Check if a cell currently has active visual effects
   */
  hasActiveEffects(cell: Cell): boolean {
    return this.activeEffects.has(cell.id);
  }

  /**
   * Clean up all active effects (useful for component destruction)
   */
  cleanup(): void {
    this.activeEffects.forEach((effect, cellId) => {
      if (effect.timer) {
        clearInterval(effect.timer);
      }
      this.logger.debug('[VisualEffects] Cleaned up effect during service cleanup', { cellId });
    });
    this.activeEffects.clear();
  }

  /**
   * Apply initial bright blue creation effect
   */
  private applyInitialCreationEffect(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';

      if (nodeType === 'text-box') {
        // For text-box shapes, apply glow to text element since body is transparent
        cell.attr('text/filter', 'drop-shadow(0 0 12px rgba(0, 150, 255, 0.9))');
      } else {
        // For all other node types, apply glow to body element
        cell.attr('body/filter', 'drop-shadow(0 0 12px rgba(0, 150, 255, 0.9))');
        cell.attr('body/strokeWidth', 4);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'drop-shadow(0 0 10px rgba(0, 150, 255, 0.9))');
      cell.attr('line/strokeWidth', 4);
    }
  }

  /**
   * Start pulse animation effect
   */
  private startPulseAnimation(cell: Cell): void {
    const startTime = Date.now();
    let pulseDirection = 1; // 1 for expanding, -1 for contracting
    let currentIntensity = 0.9;

    const activeEffect: ActiveEffect = {
      timer: null,
      cell,
      effectType: 'pulse',
      startTime,
    };

    const pulseStep = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.PULSE_DURATION_MS) {
        // Pulse animation complete
        return;
      }

      // Calculate pulse intensity (oscillating between 0.6 and 1.0)
      const pulseSpeed = 0.025;
      currentIntensity += pulseDirection * pulseSpeed;

      if (currentIntensity >= 1.0) {
        currentIntensity = 1.0;
        pulseDirection = -1;
      } else if (currentIntensity <= 0.6) {
        currentIntensity = 0.6;
        pulseDirection = 1;
      }

      // Apply pulsing effect
      this.applyPulseEffect(cell, currentIntensity);

      // Schedule next frame
      activeEffect.timer = setTimeout(pulseStep, this.ANIMATION_FRAME_INTERVAL);
    };

    activeEffect.timer = setTimeout(pulseStep, this.ANIMATION_FRAME_INTERVAL);
    this.activeEffects.set(cell.id, activeEffect);
  }

  /**
   * Apply pulse effect with given intensity
   */
  private applyPulseEffect(cell: Cell, intensity: number): void {
    const blurRadius = Math.round(8 + intensity * 8); // 8-16px blur
    const opacity = intensity;

    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';

      if (nodeType === 'text-box') {
        cell.attr('text/filter', `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`);
      } else {
        cell.attr('body/filter', `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`);
    }
  }

  /**
   * Start fade-out animation after pulse completes
   */
  private startFadeOutAnimation(cell: Cell): void {
    const startTime = Date.now();
    let currentOpacity = 0.6; // Start fade from end of pulse

    const activeEffect: ActiveEffect = {
      timer: null,
      cell,
      effectType: 'creation',
      startTime,
    };

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const fadeProgress = elapsed / (this.CREATION_DURATION_MS - this.PULSE_DURATION_MS);

      if (fadeProgress >= 1.0) {
        // Fade complete - remove all effects
        this.removeAllEffectsFromCell(cell);
        this.activeEffects.delete(cell.id);
        this.logger.debug('[VisualEffects] Creation highlight fade-out complete', {
          cellId: cell.id,
        });
        return;
      }

      // Calculate fade opacity (ease-out curve)
      const easeOut = 1 - Math.pow(fadeProgress, 2);
      currentOpacity = 0.6 * easeOut;

      // Apply fading effect
      this.applyFadeEffect(cell, currentOpacity);

      // Schedule next frame
      activeEffect.timer = setTimeout(fadeStep, this.ANIMATION_FRAME_INTERVAL);
    };

    activeEffect.timer = setTimeout(fadeStep, this.ANIMATION_FRAME_INTERVAL);
    this.activeEffects.set(cell.id, activeEffect);
  }

  /**
   * Apply fade effect with given opacity
   */
  private applyFadeEffect(cell: Cell, opacity: number): void {
    const blurRadius = Math.round(8 + opacity * 8); // Blur fades with opacity

    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';

      if (nodeType === 'text-box') {
        if (opacity <= 0.1) {
          cell.attr('text/filter', 'none');
        } else {
          cell.attr(
            'text/filter',
            `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`,
          );
        }
      } else {
        if (opacity <= 0.1) {
          cell.attr('body/filter', 'none');
          cell.attr('body/strokeWidth', 2); // Reset to default
        } else {
          cell.attr(
            'body/filter',
            `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`,
          );
          // Gradually reduce stroke width
          const strokeWidth = Math.max(2, Math.round(2 + opacity * 2));
          cell.attr('body/strokeWidth', strokeWidth);
        }
      }
    } else if (cell.isEdge()) {
      if (opacity <= 0.1) {
        cell.attr('line/filter', 'none');
        cell.attr('line/strokeWidth', 2); // Reset to default
      } else {
        cell.attr('line/filter', `drop-shadow(0 0 ${blurRadius}px rgba(0, 150, 255, ${opacity}))`);
        // Gradually reduce stroke width
        const strokeWidth = Math.max(2, Math.round(2 + opacity * 2));
        cell.attr('line/strokeWidth', strokeWidth);
      }
    }
  }

  /**
   * Remove all visual effects from a cell
   */
  private removeAllEffectsFromCell(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';

      if (nodeType === 'text-box') {
        cell.attr('text/filter', 'none');
      } else {
        cell.attr('body/filter', 'none');
        cell.attr('body/strokeWidth', 2);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'none');
      cell.attr('line/strokeWidth', 2);
    }
  }

  /**
   * Check if a cell is currently selected (to avoid conflicts)
   */
  private isCellSelected(cell: Cell): boolean {
    // Check if cell has selection attributes that would indicate it's selected
    // This is a heuristic since we don't have direct access to selection state
    try {
      if (cell.isNode()) {
        const nodeType = (cell as any).getNodeTypeInfo
          ? (cell as any).getNodeTypeInfo().type
          : 'process';

        if (nodeType === 'text-box') {
          const filter = cell.attr('text/filter');
          return !!(filter && typeof filter === 'string' && filter.includes('rgba(255, 0, 0')); // Red glow indicates selection
        } else {
          const filter = cell.attr('body/filter');
          const strokeWidth = cell.attr('body/strokeWidth');
          return !!(
            (filter && typeof filter === 'string' && filter.includes('rgba(255, 0, 0')) || // Red glow
            strokeWidth === 3 // Selection stroke width
          );
        }
      } else if (cell.isEdge()) {
        const filter = cell.attr('line/filter');
        const strokeWidth = cell.attr('line/strokeWidth');
        return !!(
          (filter && typeof filter === 'string' && filter.includes('rgba(255, 0, 0')) || // Red glow
          strokeWidth === 3 // Selection stroke width
        );
      }
    } catch (error) {
      this.logger.debug('[VisualEffects] Error checking selection state', {
        cellId: cell.id,
        error,
      });
    }

    return false;
  }
}
