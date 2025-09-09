import requests
import json

def test_geocoding():
    url = "http://localhost:3001/api/geocoding/reverse"
    payload = {
        "latitude": 3.848033,
        "longitude": 11.502075
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Formatted Address: {data.get('formatted_address')}")
            print(f"City: {data.get('city')}")
            print(f"Neighbourhood: {data.get('neighbourhood')}")
            print(f"Country: {data.get('country')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_geocoding() 