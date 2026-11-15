import unittest

from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.main import app, parse_coordinates


class ParseCoordinatesTests(unittest.TestCase):
    def test_parses_bbox_and_point_in_wgs84_order(self) -> None:
        self.assertEqual(parse_coordinates("-122.2,37.4,-122.1,37.5", 4, "bbox"), (-122.2, 37.4, -122.1, 37.5))
        self.assertEqual(parse_coordinates("-122.17,37.42", 2, "point"), (-122.17, 37.42))

    def test_rejects_invalid_coordinate_counts_and_bounds(self) -> None:
        for value, expected in (
            ("1,2", 4),
            ("1,2,3", 4),
            ("181,0", 2),
            ("0,91", 2),
            ("4,3,2,1", 4),
            ("nan,0", 2),
        ):
            with self.subTest(value=value):
                with self.assertRaises(HTTPException):
                    parse_coordinates(value, expected, "coordinate")


class HttpErrorSchemaTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_spatial_query_uses_custom_error_schema(self) -> None:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/facilities?bbox=nan,0,1,1")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json(),
            {
                "error": {
                    "code": "http_error",
                    "message": "bbox coordinates must be finite numbers.",
                }
            },
        )

    async def test_liveness_endpoint_does_not_require_a_database_query(self) -> None:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
