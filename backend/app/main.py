import asyncio
import logging
import math
from contextlib import asynccontextmanager, suppress
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal, close_database, get_session, initialize_database
from app.hub import hub
from app.models import Facility, FacilitySample
from app.schemas import DensitySample, ErrorResponse, FacilityStatus
from app.services import list_facility_statuses
from app.settings import settings
from app.worker import run_simulation

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await initialize_database()
    simulation_task = asyncio.create_task(run_simulation(), name="campus-density-simulation")
    try:
        yield
    finally:
        simulation_task.cancel()
        with suppress(asyncio.CancelledError):
            await simulation_task
        await close_database()


app = FastAPI(title="CampusPulse API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, object]] | None = None,
) -> JSONResponse:
    payload: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return JSONResponse(
        status_code=status_code,
        content={"error": payload},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
    return error_response(exc.status_code, "http_error", detail)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {
            "loc": [str(part) if isinstance(part, (str, int)) else str(part) for part in item["loc"]],
            "msg": item["msg"],
            "type": item["type"],
        }
        for item in exc.errors()
    ]
    return error_response(422, "validation_error", "The request parameters are invalid.", details)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error", exc_info=exc)
    return error_response(500, "internal_error", "An unexpected server error occurred.")


def parse_coordinates(raw: str, expected: int, label: str) -> tuple[float, ...]:
    try:
        values = tuple(float(part.strip()) for part in raw.split(","))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"{label} must contain numeric coordinates.") from exc
    if len(values) != expected:
        raise HTTPException(status_code=422, detail=f"{label} must contain {expected} coordinates.")
    if not all(math.isfinite(value) for value in values):
        raise HTTPException(status_code=422, detail=f"{label} coordinates must be finite numbers.")
    longitudes = (values[0], values[2]) if expected == 4 else (values[0],)
    if not all(-180 <= value <= 180 for value in longitudes):
        raise HTTPException(status_code=422, detail=f"{label} contains an invalid longitude.")
    if expected == 4:
        west, south, east, north = values
        if not -90 <= south <= 90 or not -90 <= north <= 90 or south >= north or west >= east:
            raise HTTPException(status_code=422, detail="bbox must be west,south,east,north with valid bounds.")
    else:
        longitude, latitude = values
        if not -90 <= latitude <= 90:
            raise HTTPException(status_code=422, detail="point latitude must be between -90 and 90.")
    return values


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/facilities", response_model=list[FacilityStatus], responses={422: {"model": ErrorResponse}})
async def facilities(
    bbox: str | None = Query(default=None, description="west,south,east,north in WGS84"),
    point: str | None = Query(default=None, description="longitude,latitude in WGS84"),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    if bbox is not None and point is not None:
        raise HTTPException(status_code=422, detail="Specify either bbox or point, not both.")
    parsed_bbox = parse_coordinates(bbox, 4, "bbox") if bbox is not None else None
    parsed_point = parse_coordinates(point, 2, "point") if point is not None else None
    return await list_facility_statuses(session, bbox=parsed_bbox, point=parsed_point)


@app.get(
    "/api/facilities/{facility_id}/history",
    response_model=list[DensitySample],
    responses={404: {"model": ErrorResponse}},
)
async def facility_history(
    facility_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[DensitySample]:
    exists = await session.scalar(select(FacilitySample.facility_id).where(FacilitySample.facility_id == facility_id).limit(1))
    if exists is None:
        facility_exists = await session.get(Facility, facility_id)
        if facility_exists is None:
            raise HTTPException(status_code=404, detail="Facility not found.")
    samples = (
        await session.scalars(
            select(FacilitySample)
            .where(FacilitySample.facility_id == facility_id)
            .order_by(FacilitySample.id.desc())
            .limit(10)
        )
    ).all()
    return [
        DensitySample(density=sample.density, sampled_at=sample.sampled_at)
        for sample in reversed(samples)
    ]


@app.websocket("/ws")
async def websocket_status(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins:
        await websocket.close(code=1008, reason="Origin is not allowed.")
        return
    await hub.connect(websocket)
    try:
        async with SessionLocal() as session:
            snapshot = await list_facility_statuses(session)
        await websocket.send_json({"type": "snapshot", "data": snapshot})
        while True:
            try:
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=settings.ws_heartbeat_seconds,
                )
            except TimeoutError:
                await websocket.send_json({"type": "ping", "data": {}})
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(websocket)
