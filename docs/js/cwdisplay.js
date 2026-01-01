const canvas = document.getElementById('morseCanvas');
const ctx = canvas.getContext('2d');

// Function to set canvas size to match parent container
function resizeCanvas() {
    const parent = canvas.parentElement;
    const parentStyle = window.getComputedStyle(parent);
    const width = parseFloat(parentStyle.width) -
        (parseFloat(parentStyle.paddingLeft) +
            parseFloat(parentStyle.paddingRight) +
            parseFloat(parentStyle.borderLeftWidth) +
            parseFloat(parentStyle.borderRightWidth));
    const height = parseFloat(parentStyle.height) -
        (parseFloat(parentStyle.paddingTop) +
            parseFloat(parentStyle.paddingBottom) +
            parseFloat(parentStyle.borderTopWidth) +
            parseFloat(parentStyle.borderBottomWidth));
    canvas.width = width;
    canvas.height = height;
    // Redraw background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Initial size and resize listener
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Drawing settings
let xOffset = 0; // Tracks scroll position
let scrollSpeed; // Pixels per frame, scaled to canvas
let isDrawing = false; // Tracks signal state
let lineY; // Vertical position, dynamic
let lineWidth; // Thickness, dynamic
const signalSegments = []; // Stores {start, end} of signal "on" periods
let currentSegment = null; // Tracks active segment

// Morse code decoding variables
let decodedText = ''; // Stores decoded morse code
let currentMorseChar = ''; // Current morse character being built
let lastSegmentEnd = null; // Track last segment end for gap detection

// Morse timing thresholds (will be calibrated)
const TIMING_THRESHOLD_MULTIPLIER = 1.5; // Used to distinguish dot from dash
let avgDotDuration = null; // Average duration of a dot
let dotDurations = []; // Store recent dot durations for averaging
let autoClearTimer = null; // Timer for auto-clearing decoded text

// Update dynamic settings based on canvas size
function updateSettings() {
    scrollSpeed = canvas.width * 0.004; // Scale scroll speed
    lineY = canvas.height / 2; // Center vertically
    lineWidth = canvas.height * 0.05; // 5% of canvas height
}

// Draw the Morse code signal from segments
function drawSignal() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';

    // Draw all visible segments
    signalSegments.forEach(segment => {
        const startX = canvas.width - (xOffset - segment.start);
        const endX = segment.end !== null ? canvas.width - (xOffset - segment.end) : canvas.width;
        // Only draw if segment is visible
        if (startX < canvas.width && endX > 0) {
            ctx.moveTo(Math.max(0, startX), lineY);
            ctx.lineTo(Math.min(canvas.width, endX), lineY);
        }
    });

    // Draw the current segment if active
    if (currentSegment) {
        const startX = canvas.width - (xOffset - currentSegment.start);
        ctx.moveTo(Math.max(0, startX), lineY);
        ctx.lineTo(canvas.width, lineY);
    }

    ctx.stroke();
}

// Animation loop
function animate() {
    // Update settings in case canvas resized
    updateSettings();

    // Update signal segments
    if (isDrawing && !currentSegment) {
        // Start a new segment
        currentSegment = { start: xOffset, end: null };
    } else if (!isDrawing && currentSegment) {
        // End the current segment
        currentSegment.end = xOffset;
        signalSegments.push(currentSegment);
        
        // Decode morse code from the segment
        decodeMorseSegment(currentSegment);
        
        currentSegment = null;
        lastSegmentEnd = xOffset;
    } else if (isDrawing && currentSegment) {
        // Update current segment's end
        currentSegment.end = xOffset;
    }

    // Check for character or word gaps
    if (!isDrawing && lastSegmentEnd !== null) {
        const gapDuration = xOffset - lastSegmentEnd;
        checkMorseGaps(gapDuration);
    }

    // Update xOffset
    xOffset += scrollSpeed;

    // Clean up old segments
    while (signalSegments.length > 0 && (xOffset - signalSegments[0].end) > canvas.width) {
        signalSegments.shift();
    }

    // Draw the signal
    drawSignal();

    requestAnimationFrame(animate);
}

// Decode a morse code segment (dot or dash)
function decodeMorseSegment(segment) {
    const duration = segment.end - segment.start;
    
    // Initialize timing if this is the first segment
    if (avgDotDuration === null) {
        avgDotDuration = duration;
        dotDurations.push(duration);
    }
    
    // Determine if this is a dot or dash
    let symbol;
    if (duration < avgDotDuration * TIMING_THRESHOLD_MULTIPLIER) {
        symbol = '.';
        // Update average dot duration
        dotDurations.push(duration);
        if (dotDurations.length > 10) dotDurations.shift(); // Keep last 10
        avgDotDuration = dotDurations.reduce((a, b) => a + b, 0) / dotDurations.length;
    } else {
        symbol = '-';
    }
    
    currentMorseChar += symbol;
    console.log('Morse symbol:', symbol, 'Current char:', currentMorseChar);
}

// Check for character or word gaps in morse code
function checkMorseGaps(gapDuration) {
    if (!avgDotDuration) return;
    
    // Character gap (3 dot durations)
    if (gapDuration > avgDotDuration * 2 && currentMorseChar.length > 0) {
        decodeMorseCharacter();
    }
    
    // Word gap (7 dot durations)
    if (gapDuration > avgDotDuration * 5) {
        if (decodedText.length > 0 && !decodedText.endsWith(' ')) {
            decodedText += ' ';
            console.log('Word gap - Decoded text:', decodedText);
            updateDecodedTextDisplay();
        }
    }
}

// Decode the current morse character
function decodeMorseCharacter() {
    if (currentMorseChar.length === 0) return;
    
    try {
        // Use the MorseCode library to decode
        const decoded = MorseCode.decode(currentMorseChar);
        if (decoded) {
            decodedText += decoded;
            console.log('Decoded character:', decoded, '- Full text:', decodedText);
            updateDecodedTextDisplay();
        }
    } catch (e) {
        console.log('Could not decode:', currentMorseChar);
    }
    
    currentMorseChar = '';
}

// Update the decoded text display in the UI
function updateDecodedTextDisplay() {
    const displayElement = document.getElementById('decodedTextContent');
    if (displayElement) {
        displayElement.textContent = decodedText;
    }
    
    // Clear existing timer
    if (autoClearTimer) {
        clearTimeout(autoClearTimer);
    }
    
    // Set timer to clear after 8 seconds of inactivity
    autoClearTimer = setTimeout(() => {
        clearDecodedText();
    }, 5000);
}

// Function to get the decoded text
function getDecodedText() {
    return decodedText;
}

// Function to reset the decoder
function resetDecoder() {
    decodedText = '';
    currentMorseChar = '';
    lastSegmentEnd = null;
    avgDotDuration = null;
    dotDurations = [];
}

// Function to clear the decoded text display
function clearDecodedText() {
    decodedText = '';
    currentMorseChar = '';
    updateDecodedTextDisplayImmediate();
    
    // Clear the auto-clear timer
    if (autoClearTimer) {
        clearTimeout(autoClearTimer);
        autoClearTimer = null;
    }
    
    console.log('Decoded text cleared');
}

// Update display without resetting the timer
function updateDecodedTextDisplayImmediate() {
    const displayElement = document.getElementById('decodedTextContent');
    if (displayElement) {
        displayElement.textContent = decodedText;
    }
}

// Start animation
animate();