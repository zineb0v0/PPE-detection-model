document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('liveVideo');
    const canvas = document.getElementById('detectionCanvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('startCamera');
    const stopBtn = document.getElementById('stopCamera');
    const uploadBtn = document.getElementById('uploadBtn');
    const mediaUpload = document.getElementById('mediaUpload');
    const resultsContainer = document.getElementById('resultsContainer');
    const alertCount = document.getElementById('alertCount');
    
    let stream = null;
    let ws = null;
    let detectionHistory = [];
    
    // Set canvas size
    canvas.width = video.offsetWidth;
    canvas.height = video.offsetHeight;
    
    // Start camera
    startBtn.addEventListener('click', async function() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            video.srcObject = stream;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Connect to WebSocket
            connectWebSocket();
            
            // Start processing frames
            processVideo();
        } catch (err) {
            console.error('Camera error:', err);
            alert('Could not access the camera. Please check permissions.');
        }
    });
    
    // Stop camera
    stopBtn.addEventListener('click', function() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            startBtn.disabled = false;
            stopBtn.disabled = true;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Close WebSocket
            if (ws) {
                ws.close();
                ws = null;
            }
        }
    });
    
    // Upload media
    uploadBtn.addEventListener('click', function() {
        mediaUpload.click();
    });
    
    mediaUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Clear previous results
        resultsContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Processing media...</p></div>';
        
        // Handle image upload
        if (file.type.startsWith('image/')) {
            processImage(file);
        } 
        // Handle video upload
        else if (file.type.startsWith('video/')) {
            processVideoFile(file);
        }
    });
    
    // WebSocket connection
    function connectWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}/ws/video`);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                detectionHistory.push(data);
                updateDetectionResults(data);
            } catch (e) {
                console.error('Error parsing WebSocket data:', e);
            }
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    // Process video frames
    function processVideo() {
        if (!stream) return;
        
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Send frame to WebSocket every 200ms
        if (ws && ws.readyState === WebSocket.OPEN) {
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            ws.send(imageData);
        }
        
        // Draw detection boxes
        if (detectionHistory.length > 0) {
            const latest = detectionHistory[detectionHistory.length - 1];
            drawDetections(latest.detections);
        }
        
        // Continue processing
        requestAnimationFrame(processVideo);
    }
    
    // Process uploaded image
    async function processImage(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/detect/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Detection failed');
            }
            
            const data = await response.json();
            displayImageResults(data);
        } catch (error) {
            console.error('Error:', error);
            resultsContainer.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }
    
    // Display image results
    function displayImageResults(data) {
        resultsContainer.innerHTML = '';
        
        if (data.detections.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No PPE detected in this image.</p></div>';
            return;
        }
        
        // Create result elements
        const img = document.createElement('img');
        img.src = data.image_path;
        img.alt = 'Detection results';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';
        
        resultsContainer.appendChild(img);
        
        data.detections.forEach(detection => {
            const card = document.createElement('div');
            card.className = `detection-card ${ALERT_CLASSES.includes(detection.class) ? 'alert' : ''}`;
            card.innerHTML = `
                <div class="class-name">
                    <i class="fas ${ALERT_CLASSES.includes(detection.class) ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                    ${detection.class}
                </div>
                <div class="confidence">${Math.round(detection.confidence * 100)}%</div>
                <div class="box-coords">Box: [${detection.box.map(num => Math.round(num)).join(', ')}]</div>
            `;
            resultsContainer.appendChild(card);
        });
        
        // Update alert count if needed
        if (data.detections.some(d => ALERT_CLASSES.includes(d.class))) {
            alertCount.textContent = parseInt(alertCount.textContent || 0) + 1;
        }
    }
    
    // Draw detections on canvas
    function drawDetections(detections) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        detections.forEach(detection => {
            const [x1, y1, x2, y2] = detection.box;
            const width = (x2 - x1) * canvas.width;
            const height = (y2 - y1) * canvas.height;
            const x = x1 * canvas.width;
            const y = y1 * canvas.height;
            
            // Draw box
            ctx.strokeStyle = ALERT_CLASSES.includes(detection.class) ? '#e74c3c' : '#2ecc71';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label background
            ctx.fillStyle = ALERT_CLASSES.includes(detection.class) ? 'rgba(231, 76, 60, 0.7)' : 'rgba(46, 204, 113, 0.7)';
            const text = `${detection.class} ${Math.round(detection.confidence * 100)}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y - 20, textWidth + 10, 20);
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(text, x + 5, y - 5);
        });
    }
    
    // Update detection results panel
    function updateDetectionResults(data) {
        // Only show the latest detection
        resultsContainer.innerHTML = '';
        
        if (data.detections.length === 0) {
            return;
        }
        
        data.detections.forEach(detection => {
            const card = document.createElement('div');
            card.className = `detection-card ${ALERT_CLASSES.includes(detection.class) ? 'alert' : ''}`;
            card.innerHTML = `
                <div class="class-name">
                    <i class="fas ${ALERT_CLASSES.includes(detection.class) ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                    ${detection.class}
                </div>
                <div class="confidence">${Math.round(detection.confidence * 100)}%</div>
                <div class="timestamp">${new Date().toLocaleTimeString()}</div>
            `;
            resultsContainer.appendChild(card);
        });
        
        // Scroll to bottom
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }
    
    // ALERT_CLASSES should be defined based on your model
    const ALERT_CLASSES = ['No-Hardhat', 'No-Safety Vest', 'No-Goggles'];
});