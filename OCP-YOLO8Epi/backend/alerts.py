import json
from pathlib import Path
from datetime import datetime

ALERTS_FILE = Path("alerts_log.json")

def load_alerts():
    if ALERTS_FILE.exists():
        try:
            with open(ALERTS_FILE, "r") as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except json.JSONDecodeError:
            print("Warning: alerts.json is corrupted or invalid. Starting with empty alerts.")
            return []
    return []
def save_alerts(alerts):
    with open(ALERTS_FILE, "w") as f:
        json.dump(alerts, f, indent=2)

alerts_log = load_alerts()

def add_alert(message, status="violation"):
    alert = {
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "message": message,
        "status": status
    }
    alerts_log.append(alert)
    save_alerts(alerts_log)
