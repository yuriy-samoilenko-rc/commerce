export interface JwtPayload {
  sub: string;
  /** Issued at, seconds (set by the JWT library). */
  iat?: number;
}
