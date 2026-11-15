import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Facility
from app.schemas import FacilityStatus


async def facility_to_status(session: AsyncSession, facility: Facility) -> dict[str, Any]:
    geometry_json = await session.scalar(
        select(func.ST_AsGeoJSON(Facility.geom)).where(Facility.id == facility.id)
    )
    geometry = json.loads(geometry_json) if geometry_json else {"type": "Polygon", "coordinates": []}
    return FacilityStatus.model_validate(
        {
            "id": facility.id,
            "name": facility.name,
            "category": facility.category,
            "capacity": facility.capacity,
            "density": facility.density,
            "wifi_count": facility.wifi_count,
            "noise_db": facility.noise_db,
            "updated_at": facility.updated_at,
            "geometry": geometry,
        }
    ).model_dump(mode="json")


async def list_facility_statuses(
    session: AsyncSession,
    *,
    bbox: tuple[float, float, float, float] | None = None,
    point: tuple[float, float] | None = None,
) -> list[dict[str, Any]]:
    statement = select(Facility).order_by(Facility.id)
    if bbox is not None:
        west, south, east, north = bbox
        envelope = func.ST_MakeEnvelope(west, south, east, north, 4326)
        statement = statement.where(func.ST_Intersects(Facility.geom, envelope))
    if point is not None:
        longitude, latitude = point
        query_point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        statement = statement.where(func.ST_Covers(Facility.geom, query_point))

    facilities = (await session.scalars(statement)).all()
    return [await facility_to_status(session, facility) for facility in facilities]
