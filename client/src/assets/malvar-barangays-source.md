# Malvar barangay boundary source record

## Source and attribution

- **Dataset:** Philippines - Subnational Administrative Boundaries, version 03; COD-AB, administrative levels 0–4.
- **Publisher/maintainer:** Contributed by OCHA Philippines; quality assured, configured, and published by OCHA Field Information Services Section and HDX.
- **Resource:** phl_admin_boundaries.shp.zip (ADM4 component phl_admin4.shp).
- **Dataset URL:** https://data.humdata.org/dataset/caf116df-f984-4deb-85ca-41b349d3f313
- **Direct resource URL:** https://data.humdata.org/dataset/caf116df-f984-4deb-85ca-41b349d3f313/resource/4e4067d6-3fc8-4d2c-91ea-330c3d4f8e8e/download/phl_admin_boundaries.shp.zip
- **Version fields:** Dataset version 03; selected ADM4 records report version v03 and valid_on 20250213. HDX resource was created 2026-05-28; dataset metadata was modified 2026-08-14.
- **Retrieved:** 2026-09-27.
- **Administrative level:** ADM4, barangay.
- **CRS:** WGS 84 longitude/latitude (GCS_WGS_1984) from phl_admin4.prj.
- **Original identifier/name fields:** adm4_pcode and adm4_name. Parent identity fields are adm2_pcode/adm2_name and adm3_pcode/adm3_name.
- **License:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO 3.0): https://creativecommons.org/licenses/by/3.0/igo/legalcode. Attribute OCHA Philippines, OCHA FIS/HDX, and PSA for PSGC crosswalk references.

The HDX record says its boundaries were created 2018-02-09 and reviewed for accuracy/completeness 2024-04-01. Its metadata date range ends 2024-04-01, while the selected ADM4 rows say valid_on 20250213. This date discrepancy is retained as a source limitation.

## Malvar selection and crosswalk

Selection required source names and hierarchy identifiers together: adm2_name = Batangas with adm2_pcode = PH04010, and adm3_name = Malvar with adm3_pcode = PH0401017. The source ADM4 P-codes are PH-prefixed forms of the exact 10-digit PSA PSGC identifiers for Malvar. The full selected identifier set was checked against the PSA municipality page and its 15-barangay table: https://psa.gov.ph/classification/psgc/barangays/0401017000.

The DISTYNC code was assigned by joining the source adm4_pcode (after removing only the PH prefix) to the PSA 10-digit code and then to the corresponding canonical DISTYNC name. The match is one-to-one; no fuzzy name matching was used. Original source identifiers and names remain unchanged in the properties. properties.distync_code is an additional application crosswalk, not a PSGC replacement.

| Source identifier | Source barangay name (adm4_name) | DISTYNC code | DISTYNC name | Match status | Notes |
| --- | --- | --- | --- | --- | --- |
| PH0401017001 | Bagong Pook | BAGONG_POOK | Bagong Pook | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017002 | Bilucao (San Isidro Western) | BILUCAO | Bilucao | PASS | P-code confirms canonical PSA name; COD label adds qualifier. |
| PH0401017003 | Bulihan | BULIHAN | Bulihan | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017005 | Luta del Norte | LUTA_DEL_NORTE | Luta del Norte | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017006 | Luta del Sur | LUTA_DEL_SUR | Luta del Sur | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017008 | Poblacion | POBLACION | Poblacion | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017020 | Santiago | SANTIAGO | Santiago | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017012 | San Andres | SAN_ANDRES | San Andres | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017013 | San Fernando | SAN_FERNANDO | San Fernando | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017004 | San Gregorio | SAN_GREGORIO | San Gregorio | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017015 | San Isidro East | SAN_ISIDRO_EAST | San Isidro East | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017016 | San Juan | SAN_JUAN | San Juan | PASS | Exact source P-code to PSA PSGC match. |
| PH0401017018 | San Pedro I (Eastern) | SAN_PEDRO_I | San Pedro I | PASS | P-code confirms canonical PSA name; COD label adds qualifier. |
| PH0401017017 | San Pedro II (Western) | SAN_PEDRO_II | San Pedro II | PASS | P-code confirms canonical PSA name; COD label adds qualifier. |
| PH0401017019 | San Pioquinto | SAN_PIOQUINTO | San Pioquinto | PASS | Exact source P-code to PSA PSGC match. |

## Transformation and validation

Only the 15 Malvar ADM4 features were extracted. Polygon parts were converted to GeoJSON Polygon/MultiPolygon rings with nesting preserved and RFC 7946 winding. Coordinates were retained without reprojection, simplification, or resampling. Original DBF properties were preserved and distync_code was added.

FeatureCollection and feature count, unique source P-codes, exact PSA/DISTYNC code sets, polygon geometry types, non-empty closed rings, finite coordinates, plausible bounds, and ring self-intersection checks were verified programmatically. National ADM4 source rows: 42048; extracted features: 15; checked positions: 2851; rings closed during conversion: 0. Bounds (west, south, east, north): 121.100218, 13.992335, 121.184231, 14.074031. GeoJSON size: 304965 bytes.
