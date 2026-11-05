from fastapi import Request
from fastapi.responses import Response
from workers import asgi
from js import Uint8Array

from app.main import app


@app.get("/{path:path}", include_in_schema=False)
async def static_assets(path: str, request: Request) -> Response:
    assets = request.scope["env"].ASSETS
    asset_path = path or "index.html"
    result = await assets.fetch(f"https://assets.local/{asset_path}")
    if result.status == 404:
        result = await assets.fetch("https://assets.local/index.html")
    content = bytes(Uint8Array.new(await result.arrayBuffer()).to_py())
    return Response(
        content=content,
        status_code=int(result.status),
        media_type=result.headers.get("content-type"),
    )


Default = asgi.entrypoint(app)
