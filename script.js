// Piano key frequencies (in Hz)
const NOTES = {
    'C': 261.63,  // Middle C
    'C#': 277.18,
    'D': 293.66,
    'D#': 311.13,
    'E': 329.63,
    'F': 349.23,
    'F#': 369.99,
    'G': 392.00,
    'G#': 415.30,
    'A': 440.00,
    'A#': 466.16,
    'B': 493.88,
    'C2': 523.25  // High C
};

// Keyboard key mapping
const KEY_MAPPING = {
    'a': 'C',
    'w': 'C#',
    's': 'D',
    'e': 'D#',
    'd': 'E',
    'f': 'F',
    't': 'F#',
    'g': 'G',
    'y': 'G#',
    'h': 'A',
    'u': 'A#',
    'j': 'B',
    'k': 'C2'
};

// Built-in songs database
const SONG_DATABASE = {
    "Twinkle Twinkle Little Star": {
        notes: ["C", "C", "G", "G", "A", "A", "G", "F", "F", "E", "E", "D", "D", "C"],
        tempo: 500 // milliseconds between notes
    },
    "Happy Birthday": {
        notes: ["C", "C", "D", "C", "F", "E", "C", "C", "D", "C", "G", "F"],
        tempo: 600
    },
    "Jingle Bells": {
        notes: ["E", "E", "E", "E", "E", "E", "E", "G", "C", "D", "E"],
        tempo: 400
    },
    "Mary Had a Little Lamb": {
        notes: ["E", "D", "C", "D", "E", "E", "E", "D", "D", "D", "E", "G", "G"],
        tempo: 500
    }
};

// Store active oscillators
const activeOscillators = {};

// Playback state
let currentSong = null;
let currentNoteIndex = 0;
let playbackInterval = null;
let isPlaying = false;
let audioContext = null;

// Debug mode
let debugMode = false;
let debugLogQueue = [];
const MAX_DEBUG_LOGS = 10;

// Debug functions
function enableDebugMode() {
    debugMode = true;
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.innerHTML = `
        <h3>Debug Panel</h3>
        <div class="debug-controls">
            <button id="toggleDebug">Disable Debug</button>
        </div>
        <div class="debug-status">
            <p>Audio Context: <span id="audioContextStatus">Not initialized</span></p>
            <p>Playback Status: <span id="playbackStatus">Stopped</span></p>
            <p>Current Song: <span id="currentSongName">None</span></p>
            <p>Current Note Index: <span id="currentNoteIdx">0</span>/<span id="totalNotes">0</span></p>
            <p>Current Note: <span id="currentNotePlaying">None</span></p>
            <p>Tempo: <span id="songTempo">0</span>ms</p>
        </div>
        <div class="debug-logs">
            <h4>Log:</h4>
            <ul id="debugLogList"></ul>
        </div>
    `;
    
    document.querySelector('.container').appendChild(debugPanel);
    
    // Add debug styles
    const style = document.createElement('style');
    style.textContent = `
        #debugPanel {
            margin-top: 20px;
            padding: 15px;
            background: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 5px;
            text-align: left;
        }
        #debugPanel h3 {
            margin-top: 0;
            color: #333;
        }
        .debug-status {
            margin: 10px 0;
        }
        .debug-logs {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #eee;
            padding: 10px;
            background: #fff;
        }
        #debugLogList {
            padding-left: 20px;
            margin: 0;
        }
        .debug-success { color: green; }
        .debug-error { color: red; }
        .debug-info { color: blue; }
    `;
    document.head.appendChild(style);
    
    // Add toggle handler
    document.getElementById('toggleDebug').addEventListener('click', () => {
        debugMode = !debugMode;
        debugPanel.style.display = debugMode ? 'block' : 'none';
        document.getElementById('toggleDebug').textContent = debugMode ? 'Disable Debug' : 'Enable Debug';
    });
    
    debugLog('Debug mode enabled', 'info');
}

function debugLog(message, type = 'info') {
    console.log(`[DEBUG] ${message}`);
    
    if (debugMode) {
        // Add to log queue
        debugLogQueue.unshift({ message, type, timestamp: new Date().toLocaleTimeString() });
        
        // Trim queue to maximum size
        if (debugLogQueue.length > MAX_DEBUG_LOGS) {
            debugLogQueue.pop();
        }
        
        // Update visual log
        const logList = document.getElementById('debugLogList');
        if (logList) {
            logList.innerHTML = '';
            debugLogQueue.forEach(log => {
                const li = document.createElement('li');
                li.className = `debug-${log.type}`;
                li.textContent = `[${log.timestamp}] ${log.message}`;
                logList.appendChild(li);
            });
        }
    }
}

function updateDebugDisplay() {
    if (!debugMode) return;
    
    // Update audio context status
    const audioContextStatus = document.getElementById('audioContextStatus');
    if (audioContextStatus) {
        audioContextStatus.textContent = audioContext 
            ? `${audioContext.state} (sampleRate: ${audioContext.sampleRate}Hz)` 
            : 'Not initialized';
    }
    
    // Update playback status
    const playbackStatus = document.getElementById('playbackStatus');
    if (playbackStatus) {
        playbackStatus.textContent = isPlaying ? 'Playing' : 'Stopped';
    }
    
    // Update current song info
    const currentSongName = document.getElementById('currentSongName');
    if (currentSongName) {
        if (currentSong) {
            // Try to find the song name from the database
            const songName = Object.entries(SONG_DATABASE).find(
                ([_, song]) => song === currentSong
            )?.[0] || 'Custom/AI Generated';
            
            currentSongName.textContent = songName;
        } else {
            currentSongName.textContent = 'None';
        }
    }
    
    // Update note index
    const currentNoteIdx = document.getElementById('currentNoteIdx');
    const totalNotes = document.getElementById('totalNotes');
    if (currentNoteIdx && totalNotes) {
        currentNoteIdx.textContent = currentSong ? currentNoteIndex : '0';
        totalNotes.textContent = currentSong ? currentSong.notes.length : '0';
    }
    
    // Update current note
    const currentNotePlaying = document.getElementById('currentNotePlaying');
    if (currentNotePlaying && currentSong && currentNoteIndex < currentSong.notes.length) {
        currentNotePlaying.textContent = currentSong.notes[currentNoteIndex - 1] || 'None';
    } else if (currentNotePlaying) {
        currentNotePlaying.textContent = 'None';
    }
    
    // Update tempo
    const songTempo = document.getElementById('songTempo');
    if (songTempo) {
        songTempo.textContent = currentSong ? currentSong.tempo : '0';
    }
}

// Initialize Web Audio API only after user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        debugLog('Audio context initialized', 'success');
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
        debugLog('Audio context resumed from suspended state', 'info');
    }
    
    updateDebugDisplay();
}

// Function to create and play a note
function playNote(frequency, key) {
    // Ensure audio context is initialized
    initAudioContext();
    
    // If note is already playing, don't start a new one
    if (activeOscillators[key]) {
        debugLog(`Note ${key} already playing, skipping`, 'info');
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Set up the note envelope
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    activeOscillators[key] = { oscillator, gainNode };
    
    debugLog(`Playing note: ${key} (${frequency}Hz)`, 'success');
    updateDebugDisplay();
}

// Function to stop a note
function stopNote(key) {
    if (activeOscillators[key]) {
        const { oscillator, gainNode } = activeOscillators[key];
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.stop(audioContext.currentTime + 0.1);
        delete activeOscillators[key];
        
        debugLog(`Stopped note: ${key}`, 'info');
        updateDebugDisplay();
    }
}

// Function to stop all notes
function stopAllNotes() {
    Object.keys(activeOscillators).forEach(key => stopNote(key));
    debugLog('Stopped all notes', 'info');
    updateDebugDisplay();
}

// Function to play a song
function playSong(songName) {
    // Validate song exists and has required properties
    if (!songName || !SONG_DATABASE[songName] || !SONG_DATABASE[songName].notes || !SONG_DATABASE[songName].tempo) {
        debugLog(`Invalid song: ${songName}`, 'error');
        console.error('Invalid song:', songName);
        return;
    }
    
    // Ensure audio context is initialized
    initAudioContext();
    
    currentSong = SONG_DATABASE[songName];
    currentNoteIndex = 0;
    isPlaying = true;
    
    debugLog(`Starting playback of song: ${songName}`, 'info');
    debugLog(`Song has ${currentSong.notes.length} notes with tempo ${currentSong.tempo}ms`, 'info');
    
    // Stop any existing playback
    stopPlayback();
    
    // Start playing the song
    playbackInterval = setInterval(() => {
        if (!isPlaying || currentNoteIndex >= currentSong.notes.length) {
            debugLog('Song playback completed or stopped', 'info');
            stopPlayback();
            return;
        }
        
        const note = currentSong.notes[currentNoteIndex];
        if (NOTES[note]) {
            playNote(NOTES[note], note);
            
            debugLog(`Playing note ${currentNoteIndex + 1}/${currentSong.notes.length}: ${note}`, 'success');
            
            // Highlight the key
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
                setTimeout(() => keyElement.classList.remove('active'), 100);
            }
        } else {
            debugLog(`Invalid note in song: ${note}`, 'error');
        }
        
        currentNoteIndex++;
        updateDebugDisplay();
    }, currentSong.tempo);
    
    updateDebugDisplay();
}

// Function to stop playback
function stopPlayback() {
    isPlaying = false;
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        debugLog('Playback stopped', 'info');
    }
    stopAllNotes();
    currentSong = null;
    currentNoteIndex = 0;
    updateDebugDisplay();
}

// Generate random piano melody using Ollama-like patterns
function generateAiMelody() {
    const noteOptions = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const patterns = [
        // Ascending scale
        ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C2'],
        // Descending scale
        ['C2', 'B', 'A', 'G', 'F', 'E', 'D', 'C'],
        // Arpeggio
        ['C', 'E', 'G', 'C2', 'G', 'E', 'C'],
        // Pentatonic
        ['C', 'D', 'E', 'G', 'A', 'C2']
    ];
    
    // Choose a random pattern as base
    const basePattern = patterns[Math.floor(Math.random() * patterns.length)];
    const generatedNotes = [...basePattern];
    
    // Add some randomization
    for (let i = 0; i < 8; i++) {
        const randomNote = noteOptions[Math.floor(Math.random() * noteOptions.length)];
        generatedNotes.push(randomNote);
    }
    
    const tempo = 300 + Math.floor(Math.random() * 300); // Random tempo between 300-600ms
    debugLog(`Generated AI melody with ${generatedNotes.length} notes and tempo ${tempo}ms`, 'info');
    
    return {
        notes: generatedNotes,
        tempo: tempo
    };
}

// Play AI generated melody
function playAiGenerated() {
    const generatedSong = generateAiMelody();
    currentSong = generatedSong;
    currentNoteIndex = 0;
    isPlaying = true;
    
    // Ensure audio context is initialized
    initAudioContext();
    
    // Stop any existing playback
    stopPlayback();
    
    debugLog('Starting AI generated melody playback', 'info');
    
    // Start playing the song
    playbackInterval = setInterval(() => {
        if (!isPlaying || currentNoteIndex >= currentSong.notes.length) {
            debugLog('AI melody playback completed or stopped', 'info');
            stopPlayback();
            return;
        }
        
        const note = currentSong.notes[currentNoteIndex];
        if (NOTES[note]) {
            playNote(NOTES[note], note);
            
            debugLog(`Playing AI note ${currentNoteIndex + 1}/${currentSong.notes.length}: ${note}`, 'success');
            
            // Highlight the key
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
                setTimeout(() => keyElement.classList.remove('active'), 100);
            }
        }
        
        currentNoteIndex++;
        updateDebugDisplay();
    }, currentSong.tempo);
    
    updateDebugDisplay();
}

// Run a diagnostic test
function runPlaybackTest() {
    debugLog('Starting playback diagnostic test', 'info');
    
    // Test 1: Initialize audio context
    try {
        initAudioContext();
        debugLog('✓ Audio context initialized successfully', 'success');
    } catch (e) {
        debugLog(`✗ Audio context initialization failed: ${e.message}`, 'error');
        return;
    }
    
    // Test 2: Play a single note
    try {
        playNote(NOTES['C'], 'C');
        setTimeout(() => {
            stopNote('C');
            debugLog('✓ Single note playback test passed', 'success');
            
            // Test 3: Start a song
            try {
                playSong('Twinkle Twinkle Little Star');
                debugLog('✓ Song playback started', 'success');
                
                // Stop after 3 seconds and run AI test
                setTimeout(() => {
                    stopPlayback();
                    debugLog('✓ Song playback stopped successfully', 'success');
                    
                    // Test 4: AI melody
                    try {
                        playAiGenerated();
                        debugLog('✓ AI melody playback started', 'success');
                        
                        // Stop after 3 seconds
                        setTimeout(() => {
                            stopPlayback();
                            debugLog('✓ AI melody playback stopped successfully', 'success');
                            debugLog('✓ All playback tests passed!', 'success');
                        }, 3000);
                    } catch (e) {
                        debugLog(`✗ AI melody playback test failed: ${e.message}`, 'error');
                    }
                }, 3000);
            } catch (e) {
                debugLog(`✗ Song playback test failed: ${e.message}`, 'error');
            }
        }, 1000);
    } catch (e) {
        debugLog(`✗ Single note playback test failed: ${e.message}`, 'error');
    }
}

// Initialize event listeners when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Handle keyboard events for piano keys
    document.addEventListener('keydown', (event) => {
        // Initialize audio context on first user interaction
        initAudioContext();
        
        const key = event.key.toLowerCase();
        const note = KEY_MAPPING[key];
        
        if (note && NOTES[note]) {
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
                playNote(NOTES[note], key);
            }
        }
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        const note = KEY_MAPPING[key];
        
        if (note) {
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.remove('active');
                stopNote(key);
            }
        }
    });

    // Handle mouse/touch events for piano keys
    document.querySelectorAll('.white-key, .black-key').forEach(key => {
        key.addEventListener('mousedown', () => {
            // Initialize audio context on first user interaction
            initAudioContext();
            
            const note = key.getAttribute('data-note');
            key.classList.add('active');
            playNote(NOTES[note], note);
        });
        
        key.addEventListener('mouseup', () => {
            const note = key.getAttribute('data-note');
            key.classList.remove('active');
            stopNote(note);
        });
        
        key.addEventListener('mouseleave', () => {
            const note = key.getAttribute('data-note');
            key.classList.remove('active');
            stopNote(note);
        });
        
        // Touch events
        key.addEventListener('touchstart', (e) => {
            // Initialize audio context on first user interaction
            initAudioContext();
            
            e.preventDefault();
            const note = key.getAttribute('data-note');
            key.classList.add('active');
            playNote(NOTES[note], note);
        });
        
        key.addEventListener('touchend', () => {
            const note = key.getAttribute('data-note');
            key.classList.remove('active');
            stopNote(note);
        });
    });

    // Handle song selection and playback
    document.getElementById('playButton').addEventListener('click', () => {
        // Initialize audio context on first user interaction
        initAudioContext();
        
        const songSelect = document.getElementById('songSelect');
        const selectedSong = songSelect.value;
        if (selectedSong) {
            playSong(selectedSong);
        } else {
            debugLog('No song selected', 'error');
        }
    });

    document.getElementById('stopButton').addEventListener('click', stopPlayback);

    // Add AI button for Ollama integration
    const playbackControls = document.querySelector('.playback-controls');
    const aiButton = document.createElement('button');
    aiButton.id = 'aiButton';
    aiButton.textContent = 'AI Play';
    aiButton.addEventListener('click', () => {
        // Initialize audio context on first user interaction
        initAudioContext();
        playAiGenerated();
    });
    
    playbackControls.appendChild(aiButton);
    
    // Add debug controls
    const debugButton = document.createElement('button');
    debugButton.id = 'debugButton';
    debugButton.textContent = 'Debug Mode';
    debugButton.addEventListener('click', () => {
        enableDebugMode();
        updateDebugDisplay();
    });
    
    const testButton = document.createElement('button');
    testButton.id = 'testButton';
    testButton.textContent = 'Run Test';
    testButton.addEventListener('click', () => {
        if (!debugMode) {
            enableDebugMode();
        }
        runPlaybackTest();
    });
    
    playbackControls.appendChild(debugButton);
    playbackControls.appendChild(testButton);

    // Handle song search
    document.getElementById('searchButton').addEventListener('click', () => {
        const searchInput = document.getElementById('songSearch');
        const searchTerm = searchInput.value.toLowerCase();
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';
        
        Object.keys(SONG_DATABASE).forEach(songName => {
            if (songName.toLowerCase().includes(searchTerm)) {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = songName;
                resultItem.addEventListener('click', () => {
                    // Initialize audio context on first user interaction
                    initAudioContext();
                    
                    document.getElementById('songSelect').value = songName;
                    playSong(songName);
                    searchInput.value = '';
                    searchResults.innerHTML = '';
                });
                searchResults.appendChild(resultItem);
            }
        });
    });
}); 