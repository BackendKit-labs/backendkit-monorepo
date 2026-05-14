import { Inject } from '@nestjs/common';
import type { HttpClientToken } from '../core/types.js';

export const InjectHttpClient = (
  token: HttpClientToken,
): ReturnType<typeof Inject> => Inject(token.symbol);
