try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import declarative_base, sessionmaker, Session
    Base = declarative_base()
except ImportError:
    create_engine = None
    declarative_base = None
    sessionmaker = None
    Session = None
    Base = object

if settings.DATABASE_URL:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        fast_executemany=True if "pyodbc" in settings.DATABASE_URL else False
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    engine = None
    SessionLocal = None

def get_db():
    if not SessionLocal:
        yield None
        return
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    if engine:
        from app.models.article import Article, StoryCluster, CrawlLog
        Base.metadata.create_all(bind=engine)
