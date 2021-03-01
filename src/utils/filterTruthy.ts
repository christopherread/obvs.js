import { Observable, UnaryFunction, pipe, OperatorFunction } from 'rxjs';
import { filter } from 'rxjs/operators';

/** Let TypeScript know we're filtering out non-truthy values */
export function filterTruthy<T>(): UnaryFunction<
  Observable<T | null | undefined>,
  Observable<T>
> {
  return pipe(filter((x) => !!x) as OperatorFunction<T | null | undefined, T>);
}
