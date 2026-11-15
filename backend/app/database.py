from collections.abc import AsyncIterator

from geoalchemy2.elements import WKTElement
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, Facility, FacilitySample
from app.settings import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

SEED_FACILITIES = [
    {
        "id": "green-library",
        "name": "Green Library",
        "category": "Library",
        "capacity": 240,
        "density": 38,
        "wifi_count": 94,
        "noise_db": 34,
        "wkt": "POLYGON((-122.1701 37.4273,-122.1695 37.4273,-122.1695 37.4278,-122.1701 37.4278,-122.1701 37.4273))",
    },
    {
        "id": "oak-dining-hall",
        "name": "Oak Dining Hall",
        "category": "Dining",
        "capacity": 180,
        "density": 74,
        "wifi_count": 118,
        "noise_db": 67,
        "wkt": "POLYGON((-122.1714 37.4281,-122.1708 37.4281,-122.1708 37.4286,-122.1714 37.4286,-122.1714 37.4281))",
    },
    {
        "id": "maker-lab",
        "name": "Maker Lab",
        "category": "Innovation",
        "capacity": 96,
        "density": 84,
        "wifi_count": 79,
        "noise_db": 73,
        "wkt": "POLYGON((-122.1682 37.4285,-122.1676 37.4285,-122.1676 37.4290,-122.1682 37.4290,-122.1682 37.4285))",
    },
    {
        "id": "willow-wellness-center",
        "name": "Willow Wellness Center",
        "category": "Wellness",
        "capacity": 120,
        "density": 27,
        "wifi_count": 39,
        "noise_db": 39,
        "wkt": "POLYGON((-122.1720 37.4262,-122.1714 37.4262,-122.1714 37.4267,-122.1720 37.4267,-122.1720 37.4262))",
    },
    {
        "id": "student-union",
        "name": "Student Union",
        "category": "Community",
        "capacity": 320,
        "density": 61,
        "wifi_count": 185,
        "noise_db": 62,
        "wkt": "POLYGON((-122.1684 37.4256,-122.1678 37.4256,-122.1678 37.4261,-122.1684 37.4261,-122.1684 37.4256))",
    },
    {
        "id": "cedar-study-lounge",
        "name": "Cedar Study Lounge",
        "category": "Study",
        "capacity": 72,
        "density": 45,
        "wifi_count": 31,
        "noise_db": 32,
        "wkt": "POLYGON((-122.1704 37.4292,-122.1698 37.4292,-122.1698 37.4297,-122.1704 37.4297,-122.1704 37.4292))",
    },
]


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def initialize_database() -> None:
    async with engine.begin() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await connection.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        has_facilities = await session.scalar(text("SELECT EXISTS (SELECT 1 FROM facilities)"))
        if has_facilities:
            return

        for facility in SEED_FACILITIES:
            session.add(
                Facility(
                    id=facility["id"],
                    name=facility["name"],
                    category=facility["category"],
                    capacity=facility["capacity"],
                    density=facility["density"],
                    wifi_count=facility["wifi_count"],
                    noise_db=facility["noise_db"],
                    geom=WKTElement(facility["wkt"], srid=4326),
                )
            )
            session.add(
                FacilitySample(facility_id=facility["id"], density=facility["density"])
            )
        await session.commit()


async def close_database() -> None:
    await engine.dispose()
