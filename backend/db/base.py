from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

def get_engine(database_url: str = "sqlite:///./data/games.db"):
    """Create database engine."""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
    )

    # Enable foreign key constraints for SQLite
    if "sqlite" in database_url:
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine

def get_session(engine):
    """Create database session."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def init_db(engine):
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
