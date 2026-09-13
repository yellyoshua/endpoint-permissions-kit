import type { Response } from 'express';
import { failureToHttp, type UseCaseResult } from './errors';

export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_NO_CONTENT = 204;

export function respond<Value>(res: Response, result: UseCaseResult<Value>, successStatus: number): void {
  if (!result.ok) {
    const http = failureToHttp(result.failure);
    res.status(http.status).json(http.body);
    return;
  }
  if (successStatus === HTTP_NO_CONTENT) {
    res.status(HTTP_NO_CONTENT).end();
    return;
  }
  res.status(successStatus).json(result.value);
}
