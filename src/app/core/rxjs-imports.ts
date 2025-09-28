/**
 * This file centralizes RxJS imports to improve tree-shaking
 * Import only what you need from this file instead of directly from rxjs
 */

// Observable and Subject
export { Observable } from 'rxjs/internal/Observable';
export { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
export { Subscription } from 'rxjs/internal/Subscription';
export { of } from 'rxjs/internal/observable/of';
export { from } from 'rxjs/internal/observable/from';
export { interval } from 'rxjs/internal/observable/interval';
export { timer } from 'rxjs/internal/observable/timer';

// Operators
export { map } from 'rxjs/internal/operators/map';
export { filter } from 'rxjs/internal/operators/filter';
export { tap } from 'rxjs/internal/operators/tap';
export { catchError } from 'rxjs/internal/operators/catchError';
export { switchMap } from 'rxjs/internal/operators/switchMap';
export { takeUntil } from 'rxjs/internal/operators/takeUntil';
export { throwError } from 'rxjs/internal/observable/throwError';

// Add more operators as needed
