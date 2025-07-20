/**
 * This file centralizes RxJS imports to improve tree-shaking
 * Import only what you need from this file instead of directly from rxjs
 */

// Observable and Subject
export { Observable } from 'rxjs/internal/Observable';
export { Subject } from 'rxjs/internal/Subject';
export { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
export { Subscription } from 'rxjs/internal/Subscription';
export { of } from 'rxjs/internal/observable/of';
export { firstValueFrom } from 'rxjs/internal/firstValueFrom';
export { from } from 'rxjs/internal/observable/from';
export { fromEvent } from 'rxjs/internal/observable/fromEvent';
export { interval } from 'rxjs/internal/observable/interval';

// Operators
export { map } from 'rxjs/internal/operators/map';
export { filter } from 'rxjs/internal/operators/filter';
export { tap } from 'rxjs/internal/operators/tap';
export { catchError } from 'rxjs/internal/operators/catchError';
export { switchMap } from 'rxjs/internal/operators/switchMap';
export { mergeMap } from 'rxjs/internal/operators/mergeMap';
export { distinctUntilChanged } from 'rxjs/internal/operators/distinctUntilChanged';
export { takeUntil } from 'rxjs/internal/operators/takeUntil';
export { take } from 'rxjs/internal/operators/take';
export { skip } from 'rxjs/internal/operators/skip';
export { startWith } from 'rxjs/internal/operators/startWith';
export { delay } from 'rxjs/internal/operators/delay';
export { retry } from 'rxjs/internal/operators/retry';
export { share } from 'rxjs/internal/operators/share';
export { throwError } from 'rxjs/internal/observable/throwError';

// Add more operators as needed
