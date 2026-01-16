from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "SC2 Replay Analyzer"
    database_url: str = "sqlite:///./data/games.db"
    pro_database_url: str = "sqlite:///./data/pro_games.db"
    debug: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
