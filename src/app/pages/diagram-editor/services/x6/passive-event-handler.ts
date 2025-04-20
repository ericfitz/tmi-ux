import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * A service to handle passive event listeners for AntV/X6
 * This is a workaround for the warnings about non-passive event listeners
 */
@Injectable({
  providedIn: 'root',
})
export class PassiveEventHandler {
  constructor(private logger: LoggerService) {}
  /**
   * Apply passive event listener patches to the window object
   * This will override the default addEventListener method to make touch and wheel events passive
   *
   * NOTE: Currently disabled due to recursive call issues
   */
  applyPatches(): void {
    // Disabled to prevent maximum call stack size exceeded error
    // Just log a message instead
    this.logger.info('Passive event handler patches disabled to prevent recursion issues');

    // Original implementation caused infinite recursion
    // Left commented out for reference
    /*
    // Only apply patches if not already applied
    if ((window as any).__passiveEventsPatched) {
      return;
    }
    
    // Mark as patched to prevent multiple applications
    (window as any).__passiveEventsPatched = true;
    
    // Store the original addEventListener method
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    
    // Override addEventListener to make touch and wheel events passive by default
    EventTarget.prototype.addEventListener = function(
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      // Events that should be passive
      const passiveEvents = ['touchstart', 'touchmove', 'mousewheel', 'wheel'];
      
      // If the event is in the list of passive events, make it passive
      if (passiveEvents.includes(type)) {
        let newOptions: AddEventListenerOptions;
        
        if (typeof options === 'boolean') {
          newOptions = { capture: options, passive: true };
        } else if (options) {
          newOptions = { ...options, passive: true };
        } else {
          newOptions = { passive: true };
        }
        
        // Call the original addEventListener with the new options
        return originalAddEventListener.call(this, type, listener, newOptions);
      }
      
      // For other events, use the original behavior
      return originalAddEventListener.call(this, type, listener, options);
    };
    */
  }
}
