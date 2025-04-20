import { Injectable } from '@angular/core';

/**
 * A service to handle passive event listeners for AntV/X6
 * This is a workaround for the warnings about non-passive event listeners
 */
@Injectable({
  providedIn: 'root',
})
export class PassiveEventHandler {
  /**
   * Apply passive event listener patches to the window object
   * This will override the default addEventListener method to make touch and wheel events passive
   */
  applyPatches(): void {
    // Store the original addEventListener method and context
    const originalContext = EventTarget.prototype;

    // Create a wrapper using arrow function to avoid unbound method warning
    const originalAddEventListener = (
      ...args: Parameters<typeof EventTarget.prototype.addEventListener>
    ) => {
      return EventTarget.prototype.addEventListener.apply(originalContext, args);
    };

    // Override addEventListener to make touch and wheel events passive by default
    EventTarget.prototype.addEventListener = function (
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
        return originalAddEventListener(type, listener, newOptions);
      }

      // For other events, use the original behavior
      return originalAddEventListener(type, listener, options);
    };
  }
}
