import {
  Err, Middleware, Next, PlatformContext, PlatformResponse,
} from '@tsed/common';

import { HttpError, isHttpError } from 'http-errors';

@Middleware()
export class GlobalHttpErrorHandlingMiddleware {

  use(@Err() err: unknown, @Next() next: Next, ctx: PlatformContext): PlatformResponse<any>|void {

    // handle if the err is a HttpError instance
    if (isHttpError(err)) {
      const httpError = err as HttpError;
      const { response } = ctx;

      return response
        .status(httpError.status)
        .body({
          status: httpError.status,
          message: httpError.message,
        });
    }

    next(err);
  }

}
