from contextvars import ContextVar
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

_request_token: ContextVar[str] = ContextVar("football_data_request_token", default="")


class Settings(BaseSettings):
    football_data_token: str = ""
    football_data_base_url: str = "https://api.football-data.org/v4"
    data_cache_seconds: int = 600
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def settings() -> Settings:
    return Settings()


def football_data_token() -> str:
    return _request_token.get() or settings().football_data_token
