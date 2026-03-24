from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./onboard.db"
    OPENAI_KEY: str = ""
    RF_TOKEN: str = ""
    RF_API_BASE: str = "https://api.recordedfuture.com/v2"
    OPENAI_CHAT_MODEL: str = "gpt-4o"
    OPENAI_CLASSIFICATION_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    SIMILARITY_THRESHOLD: float = 0.45
    MAX_CONCURRENT_CLASSIFICATIONS: int = 5
    DARKWEB_LOOKBACK_DAYS: int = 14
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
