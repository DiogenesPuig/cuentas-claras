"""Validación del access token de Supabase (JWT) en el micro.

El micro solo autentica/autoriza la llamada: valida la *firma* del token y que
sea de un usuario logueado. NO consulta la base ni lee datos del usuario.

Dos modos, elegidos por configuración:
- **HS256** si hay `SUPABASE_JWT_SECRET` (secret simétrico legacy del proyecto).
- **JWKS** (RS256/ES256) si no, contra `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  (claves asimétricas; el modo recomendado/moderno de Supabase).

`TokenVerifier` es testeable sin red: en HS256 se le pasa el secret y listo.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from .config import Settings, get_settings


class AuthError(Exception):
    """Token ausente, mal formado, vencido o con firma inválida."""


@dataclass
class AuthenticatedUser:
    """Mínimo que el micro necesita del token: el `sub` (user id) y el `aud`."""

    user_id: str
    claims: dict


class TokenVerifier:
    """Verifica la firma del JWT. Sin estado de la DB; cachea el cliente JWKS."""

    def __init__(
        self,
        *,
        jwt_secret: str | None = None,
        jwks_url: str | None = None,
        audience: str = "authenticated",
    ) -> None:
        if not jwt_secret and not jwks_url:
            raise ValueError("Configurá SUPABASE_JWT_SECRET o SUPABASE_URL para validar el JWT.")
        self._jwt_secret = jwt_secret
        self._audience = audience
        self._jwk_client = PyJWKClient(jwks_url) if (jwks_url and not jwt_secret) else None

    def verify(self, token: str) -> AuthenticatedUser:
        try:
            if self._jwt_secret:
                claims = jwt.decode(
                    token,
                    self._jwt_secret,
                    algorithms=["HS256"],
                    audience=self._audience,
                )
            else:
                assert self._jwk_client is not None
                signing_key = self._jwk_client.get_signing_key_from_jwt(token).key
                claims = jwt.decode(
                    token,
                    signing_key,
                    algorithms=["RS256", "ES256"],
                    audience=self._audience,
                )
        except jwt.PyJWTError as exc:
            raise AuthError(str(exc)) from exc

        sub = claims.get("sub")
        if not sub:
            raise AuthError("El token no tiene `sub` (user id).")
        return AuthenticatedUser(user_id=sub, claims=claims)


@lru_cache(maxsize=4)
def _verifier_for(
    jwt_secret: str | None, jwks_url: str | None, audience: str
) -> TokenVerifier:
    # Cacheado por configuración: en modo JWKS reusa el mismo PyJWKClient entre
    # requests (y su caché de claves), en vez de refetchear el JWKS cada vez.
    return TokenVerifier(jwt_secret=jwt_secret, jwks_url=jwks_url, audience=audience)


def build_verifier(settings: Settings) -> TokenVerifier:
    return _verifier_for(
        settings.supabase_jwt_secret, settings.jwks_url, settings.jwt_audience
    )


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el header Authorization: Bearer <token>.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization[len("bearer ") :].strip()


def require_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """Dependency de FastAPI: exige un JWT de Supabase válido. 401 si no."""
    token = _extract_bearer(authorization)
    try:
        verifier = build_verifier(settings)
        return verifier.verify(token)
    except (AuthError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
