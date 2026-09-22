import sys
import os
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

current_pypath = os.environ.get("PYTHONPATH", "")
if BASE_DIR not in current_pypath:
    os.environ["PYTHONPATH"] = f"{BASE_DIR};{current_pypath}" if current_pypath else BASE_DIR

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8002))

if __name__ == "__main__":
    print(f"Starting FastAPI server at http://{HOST}:{PORT}")
    print(f"Swagger API Docs at http://localhost:{PORT}/docs")
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=True,
        app_dir=BASE_DIR
    )
