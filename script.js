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

// Initialize Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Store active oscillators
const activeOscillators = {};

// Playback state
let currentSong = null;
let currentNoteIndex = 0;
let playbackInterval = null;
let isPlaying = false;

// Fallback if SONGS isn't defined
if (typeof window.SONGS === 'undefined') {
    window.SONGS = {};
    console.warn('Songs database not found. Make sure songs.js is loaded properly.');
}

// Function to create and play a note
function playNote(frequency, key) {
    // If note is already playing, don't start a new one
    if (activeOscillators[key]) return;

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
    }
}

// Function to stop all notes
function stopAllNotes() {
    Object.keys(activeOscillators).forEach(key => stopNote(key));
}

// Function to play a song
function playSong(songName) {
    // Validate song exists and has required properties
    if (!songName || !window.SONGS[songName] || !window.SONGS[songName].notes || !window.SONGS[songName].tempo) {
        console.error('Invalid song:', songName);
        return;
    }
    
    currentSong = window.SONGS[songName];
    currentNoteIndex = 0;
    isPlaying = true;
    
    // Stop any existing playback
    stopPlayback();
    
    // Start playing the song
    playbackInterval = setInterval(() => {
        if (!isPlaying || currentNoteIndex >= currentSong.notes.length) {
            stopPlayback();
            return;
        }
        
        const note = currentSong.notes[currentNoteIndex];
        if (NOTES[note]) {
            playNote(NOTES[note], note);
            
            // Highlight the key
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
                setTimeout(() => keyElement.classList.remove('active'), 100);
            }
        }
        
        currentNoteIndex++;
    }, currentSong.tempo);
}

// Function to stop playback
function stopPlayback() {
    isPlaying = false;
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    stopAllNotes();
    currentSong = null;
    currentNoteIndex = 0;
}

// Handle keyboard events
document.addEventListener('keydown', (event) => {
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

// Handle mouse/touch events
document.querySelectorAll('.white-key, .black-key').forEach(key => {
    key.addEventListener('mousedown', () => {
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
    const songSelect = document.getElementById('songSelect');
    const selectedSong = songSelect.value;
    if (selectedSong) {
        playSong(selectedSong);
    }
});

document.getElementById('stopButton').addEventListener('click', stopPlayback);

// Handle song search
document.getElementById('searchButton').addEventListener('click', () => {
    const searchInput = document.getElementById('songSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '';
    
    Object.keys(window.SONGS).forEach(songName => {
        if (songName.toLowerCase().includes(searchTerm)) {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.textContent = songName;
            resultItem.addEventListener('click', () => {
                document.getElementById('songSelect').value = songName;
                playSong(songName);
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
            searchResults.appendChild(resultItem);
        }
    });
}); 