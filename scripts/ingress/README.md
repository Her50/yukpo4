# LiveKit Ingress Operational Scripts

These scripts help operators provision and manage LiveKit ingress endpoints in production.

## Prerequisites

- `python3`, `pip`, `envsubst`, `jq`, `curl`
- Populate `.env.livekit` at the repository root with private settings:

  ```
  LIVEKIT_HOST=46.224.14.85
  LIVEKIT_HTTP=http://46.224.14.85:7880
  LIVEKIT_WS=ws://46.224.14.85:7880
  LIVEKIT_API_KEY=...
  LIVEKIT_API_SECRET=...
  LIVEKIT_INGRESS_NAME=prod-ingress-1
  LIVEKIT_INGRESS_ROOM=live-events
  ```

  > Store this file securely; never commit secrets.

## Generate a JWT token

```
./scripts/livekit_jwt.py --identity ops-cli --ttl 300
```

## Create a new ingress

```
./scripts/ingress/create_ingress.sh
```

- Payload template: `create_ingress.json`
- Output saved to: `create_ingress_response.json`

## Stream test (ffmpeg)

```
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000 \
  -c:v libx264 -preset veryfast -b:v 2500k \
  -c:a aac -b:a 128k -ar 48000 \
  -f flv "rtmp://$LIVEKIT_HOST:1935/live/<stream_key>"
```

Replace `<stream_key>` by the value returned in `create_ingress_response.json`.

