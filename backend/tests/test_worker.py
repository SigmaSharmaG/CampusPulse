import unittest
from unittest.mock import patch

from app.worker import bounded_random_walk


class BoundedRandomWalkTests(unittest.TestCase):
    def test_density_changes_stay_within_the_valid_range(self) -> None:
        with patch("app.worker.random.uniform", return_value=-7):
            self.assertEqual(bounded_random_walk(0), 0)
        with patch("app.worker.random.uniform", return_value=7):
            self.assertEqual(bounded_random_walk(100), 100)

    def test_density_moves_by_a_bounded_step(self) -> None:
        with patch("app.worker.random.uniform", return_value=3.25):
            self.assertEqual(bounded_random_walk(42), 45.2)
