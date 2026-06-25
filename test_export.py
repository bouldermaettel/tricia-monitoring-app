import requests
import json
import pandas as pd
from io import BytesIO

BASE_URL = "http://localhost:8000/api"

def test_export():
    payload = {
        "columns": ["vk_number", "TRI-S", "TRI-D", "audit_trail"],
        "filters": {
            "include_excluded": True,
            "problematic_only": False,
            "all": True
        }
    }
    
    print("Testing XLSX export with filters...")
    response = requests.post(f"{BASE_URL}/exports/table.xlsx", json=payload)
    
    if response.status_code == 200:
        df = pd.read_excel(BytesIO(response.content))
        print(f"Success! Exported {len(df)} rows.")
        print("\nColumns found:", df.columns.tolist())
        if "audit_trail" in df.columns:
            print("Audit trail column is present.")
        if len(df) > 0:
            print("\nFirst row sample:")
            print(df.iloc[0].to_dict())
    else:
        print(f"Failed with status {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    try:
        test_export()
    except Exception as e:
        print(f"Error: {e}")
