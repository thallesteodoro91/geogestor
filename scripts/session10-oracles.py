from __future__ import annotations

import json
import math
import platform
import sys
from pathlib import Path

from geographiclib.geodesic import Geodesic
from pyproj import CRS, Proj, Transformer, __version__ as pyproj_version, proj_version_str
from shapely import __version__ as shapely_version
from shapely.geometry import Polygon
from shapely.validation import explain_validity


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "auditorias" / "2026-09-13-topografia" / "evidencias" / "oraculos-independentes.json"
GRS80 = Geodesic(6378137.0, 1 / 298.257222101)


def transform(source: int, target: int, longitude: float, latitude: float) -> dict[str, float]:
    transformer = Transformer.from_crs(source, target, always_xy=True)
    x, y = transformer.transform(longitude, latitude)
    inverse = Transformer.from_crs(target, source, always_xy=True)
    recovered_longitude, recovered_latitude = inverse.transform(x, y)
    return {
        "longitude": longitude,
        "latitude": latitude,
        "x": x,
        "y": y,
        "roundTripLongitude": recovered_longitude,
        "roundTripLatitude": recovered_latitude,
        "roundTripErrorDegrees": max(abs(recovered_longitude - longitude), abs(recovered_latitude - latitude)),
    }


def inverse(geodesic: Geodesic, latitude1: float, longitude1: float, latitude2: float, longitude2: float) -> dict[str, float | None]:
    result = geodesic.Inverse(latitude1, longitude1, latitude2, longitude2)
    coincident = latitude1 == latitude2 and longitude1 == longitude2
    return {
        "distanceMeters": result["s12"],
        "initialBearingDegrees": None if coincident else result["azi1"] % 360,
        "finalBearingDegrees": None if coincident else result["azi2"] % 360,
    }


def geodesic_polygon(points: list[tuple[float, float]], geodesic: Geodesic = GRS80) -> dict[str, float]:
    polygon = geodesic.Polygon()
    for latitude, longitude in points:
        polygon.AddPoint(latitude, longitude)
    _, perimeter, signed_area = polygon.Compute(False, True)
    return {"areaSquareMeters": abs(signed_area), "perimeterMeters": perimeter}


def planar(points: list[tuple[float, float]]) -> dict[str, float]:
    doubled_area = 0.0
    perimeter = 0.0
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % len(points)]
        doubled_area += x1 * y2 - x2 * y1
        perimeter += math.hypot(x2 - x1, y2 - y1)
    return {"areaSquareMeters": abs(doubled_area) / 2, "perimeterMeters": perimeter}


def main() -> None:
    florianopolis = (-48.54822, -27.59487)
    factors = Proj("EPSG:31982").get_factors(*florianopolis)
    geographic_small = [
        (-27.595, -48.548),
        (-27.595, -48.547),
        (-27.594, -48.547),
        (-27.594, -48.548),
    ]
    antimeridian_polygon = [
        (10.0, 179.8),
        (10.0, -179.8),
        (10.2, -179.8),
        (10.2, 179.8),
    ]
    invalid_polygons = {
        "duplicate": [(0, 0), (10, 0), (10, 0), (0, 10)],
        "collinear": [(0, 0), (5, 0), (10, 0)],
        "bowTie": [(0, 0), (10, 10), (0, 10), (10, 0)],
        "overlap": [(0, 0), (4, 0), (4, 4), (1, 4), (1, 0), (3, 0), (3, 3), (0, 3)],
    }
    payload = {
        "runtime": {
            "python": platform.python_version(),
            "pyproj": pyproj_version,
            "proj": proj_version_str,
            "geographiclib": __import__("geographiclib").__version__,
            "shapely": shapely_version,
            "axisPolicy": "always_xy=True (longitude/easting, latitude/northing)",
        },
        "crs": {
            "epsg31982": CRS.from_epsg(31982).to_json_dict(),
            "florianopolisSirgas2000To31982": transform(4674, 31982, *florianopolis),
            "florianopolisWgs84To32722": transform(4326, 32722, *florianopolis),
            "boaVistaSirgas2000To31974": transform(4674, 31974, -60.6758, 2.8235),
            "zoneBoundaryWest": transform(4674, 31981, -54.000001, -0.000001),
            "zoneBoundaryEast": transform(4674, 31982, -54.0, 0.000001),
            "utmMetadataFlorianopolis": {
                "meridianConvergenceDegrees": factors.meridian_convergence,
                "meridionalScale": factors.meridional_scale,
                "parallelScale": factors.parallel_scale,
                "arealScale": factors.areal_scale,
            },
        },
        "geodesicsGrs80": {
            "saoPauloToRio": inverse(GRS80, -23.5505, -46.6333, -22.9068, -43.1729),
            "rioToSaoPaulo": inverse(GRS80, -22.9068, -43.1729, -23.5505, -46.6333),
            "coincident": inverse(GRS80, -27.59487, -48.54822, -27.59487, -48.54822),
            "almostCoincident": inverse(GRS80, -27.59487, -48.54822, -27.594869999, -48.548219999),
            "almostAntipodal": inverse(GRS80, 0, 0, 0.0001, 179.9999),
            "antimeridian": inverse(GRS80, 10, 179.9, 10, -179.9),
            "shortNorth": inverse(GRS80, -27.59487, -48.54822, -27.59478, -48.54822),
        },
        "planar": {
            "square10": planar([(0, 0), (10, 0), (10, 10), (0, 10)]),
            "rectangle20x5": planar([(0, 0), (20, 0), (20, 5), (0, 5)]),
            "triangle": planar([(0, 0), (10, 0), (0, 10)]),
            "irregular": planar([(0, 0), (8, 0), (10, 4), (4, 9), (-1, 5)]),
        },
        "geographicPolygonsGrs80": {
            "small": geodesic_polygon(geographic_small),
            "smallReversed": geodesic_polygon(list(reversed(geographic_small))),
            "antimeridian": geodesic_polygon(antimeridian_polygon),
            "antimeridianReversed": geodesic_polygon(list(reversed(antimeridian_polygon))),
        },
        "topologyShapely": {
            name: {"isValid": Polygon(points).is_valid, "reason": explain_validity(Polygon(points)), "area": Polygon(points).area}
            for name, points in invalid_polygons.items()
        },
        "unitIdentities": {
            "oneHectareSquareMeters": 10_000,
            "oneSquareKilometerSquareMeters": 1_000_000,
            "oneKilometerMeters": 1_000,
        },
        "tolerances": {
            "projectedCoordinateMeters": 0.01,
            "crsRoundTripDegrees": 1e-8,
            "geodesicDistanceMeters": 0.005,
            "geodesicBearingDegrees": 1e-7,
            "geodesicAreaSquareMeters": 0.05,
            "planarComputational": 1e-9,
            "visualCoordinateMeters": 0.001,
            "visualDistanceMeters": 0.001,
            "visualBearingDegrees": 0.01,
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "runtime": payload["runtime"], "keyResults": {
        "florianopolis": payload["crs"]["florianopolisSirgas2000To31982"],
        "saoPauloToRio": payload["geodesicsGrs80"]["saoPauloToRio"],
        "smallPolygon": payload["geographicPolygonsGrs80"]["small"],
        "utmMetadata": payload["crs"]["utmMetadataFlorianopolis"],
    }}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
