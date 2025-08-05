from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse,StreamingResponse, JSONResponse 
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi import UploadFile, File
import shutil
from ultralytics import YOLO
import cv2
import os
from alerts import add_alert, alerts_log
from alerts_categories import BLUE_CLASSES, YELLOW_CLASSES,RED_CLASSES, CLASS_NAMES, get_danger_info
from database import init_db , get_alert_history
from violation_track import track_violation


init_db()

app = FastAPI()

model = None

@app.on_event("startup")
def load_model():
    global model
    model = YOLO(str(Path("models") / "best.pt"))

BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "UIpage" / "frontend" / "static"), name="static")

#je crée un dossier uploads/ à la racine de ton projet si ce n’est pas déjà fait.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

templates = Jinja2Templates(directory=str(BASE_DIR / "UIpage" / "frontend"))
last_uploaded_video = None


#Crée une route POST /upload qui prend un fichier vidéo. Le fichier est accessible via la variable file.
@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    global last_uploaded_video
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    last_uploaded_video = file_path
    print(f"Uploaded file saved at: {last_uploaded_video}")
    return {"message": f"Uploaded successfully: {file.filename}"}

def gen_frames(video_path, conf=0.1, skip_frames=2):
    cap = cv2.VideoCapture(str(video_path))
    frame_count = 0

    while True:
        success, frame = cap.read()
        if not success:
            break

        frame_count += 1
        if frame_count % skip_frames != 0:
            continue

        results = model(frame, conf=0.1)[0]

        for box in results.boxes:
            cls = int(box.cls[0])
            info = get_danger_info(cls)
            color = info["color"]
            danger_level = info["category"]

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf_score = box.conf[0]
            label = f"{danger_level} {conf_score:.2f}"

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            if cls in RED_CLASSES:
                track_violation(cls)

        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()

@app.get("/video_feed")
def video_feed():
    if last_uploaded_video is None:
        return HTMLResponse("No video uploaded yet.")
    return StreamingResponse(gen_frames(last_uploaded_video),
                             media_type='multipart/x-mixed-replace; boundary=frame')



@app.get("/alerts")
def get_alerts():
    return JSONResponse(content=alerts_log)

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/history")
def get_history():
    history = get_alert_history()
    return {"history": [
        {"time": row[0], "message": row[1], "status": row[2]} for row in history
    ]}@app.get("/ip-cameras")

def get_ip_cameras():
    fake_cameras = [
        {"id": 1, "name": "Main Gate Camera", "url": "rtsp://192.168.1.101/live"},
        {"id": 2, "name": "Warehouse Entry", "url": "rtsp://192.168.1.102/live"},
        {"id": 3, "name": "Parking Zone", "url": "rtsp://192.168.1.103/live"},
    ]
    return {"cameras": fake_cameras}
