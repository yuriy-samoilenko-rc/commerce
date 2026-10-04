export interface JwtPayload {
  sub: string;
  /** Issued at, seconds (set by the JWT library). */
  iat?: number;
  /** Issued at, milliseconds: `iat` alone cannot tell a token from a password change in the same second. */
  iatMs?: number;
}
