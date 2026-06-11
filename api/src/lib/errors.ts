/** Erreur métier portant un status HTTP et un code stable côté client. */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const NotFound = (msg = 'Introuvable') => new AppError(404, 'not_found', msg);
export const BadRequest = (code: string, msg: string) => new AppError(400, code, msg);
export const Unauthorized = (msg = 'Non authentifié') => new AppError(401, 'unauthorized', msg);
export const Conflict = (code: string, msg: string) => new AppError(409, code, msg);
/** 422 : la requête est valide mais la règle métier la refuse (ex: trop loin de la toilette). */
export const Unprocessable = (code: string, msg: string) => new AppError(422, code, msg);
/** 429 : quota dépassé (ex: limite d'ajout de toilettes par jour). */
export const TooManyRequests = (code: string, msg: string) => new AppError(429, code, msg);
