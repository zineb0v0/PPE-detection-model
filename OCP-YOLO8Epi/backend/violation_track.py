from collections import defaultdict, deque
import time
from alerts import add_alert, alerts_log
from alerts_categories import CLASS_NAMES
from database import insert_alert

violation_memory = defaultdict(lambda: deque(maxlen=10))

# Configurable thresholds
ALERT_THRESHOLD = 3  # Number of repeated detections required
ROLLING_WINDOW_SECONDS = 60  # Time window in seconds

def track_violation(cls_id):
    """Tracks violations and triggers an alert if threshold is met."""
    now = time.time()
    memory = violation_memory[cls_id]
    memory.append(now)

    # Remove timestamps older than the rolling window
    while memory and now - memory[0] > ROLLING_WINDOW_SECONDS:
        memory.popleft()

    if len(memory) >= ALERT_THRESHOLD:
        current_alert = CLASS_NAMES.get(cls_id, f"Class {cls_id}")
        last_alert = alerts_log[-1]["message"] if alerts_log else None
        if current_alert != last_alert:
            add_alert(current_alert)
            insert_alert(current_alert, "violation")  # ✅ moved here
            return True  # Alert was added
    return False  # No alert
