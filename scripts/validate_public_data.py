
from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent

file_path = (
    project_root
    / "data"
    / "processed"
    / "public_bengaluru_garbage_dumps_points.csv"
)

df = pd.read_csv(file_path)

print("\n--- PUBLIC DATA VALIDATION ---")

print("\n1. Dataset shape:")
print(df.shape)

print("\n2. Missing values:")
print(df.isnull().sum())

print("\n3. Coordinate ranges:")
print("Latitude:", df["latitude"].min(), "to", df["latitude"].max())
print("Longitude:", df["longitude"].min(), "to", df["longitude"].max())

print("\n4. Unique wards:")
print("Ward count:", df["ward"].nunique())
print(df["ward"].value_counts().head(10))

print("\n5. Observation dates:")
dates = pd.to_datetime(df["observation_date"], errors="coerce")
print("Earliest:", dates.min())
print("Latest:", dates.max())
print("Unique dates:", dates.nunique())

print("\n6. Duplicate review:")
print("Flagged rows:", int(df["possible_duplicate"].sum()))

print("\n7. Sample records:")
print(
    df[
        [
            "source_record_id",
            "ward",
            "observation_date",
            "latitude",
            "longitude",
            "possible_duplicate",
        ]
    ].head(5).to_string(index=False)
)

print("\nValidation report completed.")
