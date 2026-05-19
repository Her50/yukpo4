import jwt from 'jsonwebtoken';

// Reproduit exactement backend/src/utils/jwt_manager.rs::UserClaims.
// Champs requis pour passer le middleware AuthExtractor :
//   sub (i32), role, email, name?, tokens_balance, partner_type?, iat, exp
export function forgeJwt({ userId, role, email, name = null, tokensBalance = 0, partnerType = null, ttlSecs = 60 * 60 * 24 }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET manquant (env)');
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: userId,
    role,
    email,
    name,
    tokens_balance: tokensBalance,
    partner_type: partnerType,
    iat: now,
    exp: now + ttlSecs,
  };
  return jwt.sign(claims, secret, { algorithm: 'HS256' });
}
