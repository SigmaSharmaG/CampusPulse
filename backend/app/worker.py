import asyncio
import logging
import random

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.hub import hub
from app.models import Facility, FacilitySample
from app.services import facility_to_status
from app.settings import settings

logger = logging.getLogger(__name__)


def bounded_random_walk(value: float, step: float = 7.0) -> float:
    return round(max(0.0, min(100.0, value + random.uniform(-step, step))), 1)


async def update_facility_status() -> None:
    async with SessionLocal() as session:
        facilities = (await session.scalars(select(Facility).order_by(Facility.id))).all()
        updates: list[dict[str, object]] = []
        for facility in facilities:
            facility.density = bounded_random_walk(facility.density)
            facility.wifi_count = max(
                0,
                min(
                    facility.capacity,
                    round(facility.capacity * facility.density / 100 * random.uniform(0.72, 1.08)),
                ),
            )
            facility.noise_db = round(
                max(25.0, min(95.0, 31.0 + facility.density * 0.48 + random.uniform(-4, 4))), 1
            )
            session.add(FacilitySample(facility_id=facility.id, density=facility.density))
            updates.append(await facility_to_status(session, facility))

        await session.commit()

        for facility in facilities:
            old_sample_ids = (
                await session.scalars(
                    select(FacilitySample.id)
                    .where(FacilitySample.facility_id == facility.id)
                    .order_by(FacilitySample.id.desc())
                    .offset(10)
                )
            ).all()
            if old_sample_ids:
                await session.execute(
                    delete(FacilitySample).where(FacilitySample.id.in_(old_sample_ids))
                )
        await session.commit()

    for update in updates:
        await hub.broadcast({"type": "facility.updated", "data": update})


async def run_simulation() -> None:
    while True:
        await asyncio.sleep(settings.simulation_interval_seconds)
        try:
            await update_facility_status()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Campus status simulation failed; retrying on the next interval")
