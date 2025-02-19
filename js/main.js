window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext;
const context = new AudioContext();

let buffer, buffer2; // global variables for sample files

// master gain node
const master = context.createGain();
master.connect(context.destination);

// global variables
let w, h, data;
const drawingdata = []; // an array that keeps the data
const voices = []; // an array for touch events - polyphonic
const voicesmono = []; // this will be used for mouse events - monophonic
let globalSample;
let isloaded = false;
let X = 0;
let Y = 0;
let mouseState = false;
let helpvisible = true;

// control initial settings
let attack = knobValues.attack / 100;
let release = knobValues.release / 100;
let density = knobValues.density / 100;
let spread = knobValues.spread / 100;
let reverb = knobValues.reverb;
let pan = knobValues.pan / 100;
let tuning = knobValues.tuning / 1000;

// Semitone intervals for the minor pentatonic scale
const minorPentatonicIntervals = [-12, -9, -7, -5, -2, 0, 3, 5, 7, 10, 12];

/**
 * Represents a grain.
 * @class
 */
class Grain {
    constructor(p, buffer, positionx, positiony, attack, release, spread, pan) {
        this.now = context.currentTime; // update the time value
        // create the source
        this.source = context.createBufferSource();
        this.source.buffer = buffer;
        // create the gain for enveloping
        this.gain = context.createGain();
        
        // experimenting with adding a panner node - not all the grains will be panned for better performance
        const yes = parseInt(p.random(3), 10);
        if (yes === 1) {
            this.panner = context.createPanner();
            this.panner.panningModel = "equalpower";
            this.panner.distanceModel = "linear";
            this.panner.setPosition(p.random(pan * -1, pan), 0, 0);
            // connections
            this.source.connect(this.panner);
            this.panner.connect(this.gain);
        } else {
            this.source.connect(this.gain);
        }
        
        this.gain.connect(master);
        
        // update the position and calculate the offset
        this.positionx = positionx;
        this.offset = this.positionx * (buffer.duration / w); // pixels to seconds
        this.amp = 0.6;
        
        // update and calculate the pitch
        if (positionYPitch) {
            this.positiony = positiony;
            const scaledPositionY = p.map(this.positiony / h, 0.0, 1.0, 1.0, -1.0);

            // Quantize pitch based on the selected mode
            if (pitchQuantizeMode === QuantizeMode.CHROMATIC || pitchQuantizeMode === QuantizeMode.MINOR_PENTATONIC) {
                const semitones = pitchQuantizeMode === QuantizeMode.CHROMATIC
                    ? this.mapInputToSemitones(scaledPositionY)
                    : this.mapInputToMinorPentatonic(scaledPositionY);
                const quantizedPlaybackRate = this.semitoneToPlaybackRate(semitones);
                this.source.playbackRate.value = quantizedPlaybackRate + tuning;
                console.log("Quantized playback rate: " + this.source.playbackRate.value);
            } else if (pitchQuantizeMode === QuantizeMode.NONE) {
                this.source.playbackRate.value = 1 + scaledPositionY + tuning;
                console.log("Unquantized layback rate: " + this.source.playbackRate.value);
            } else {
                console.error('Invalid pitch quantize mode');
            }
        }
        
        // parameters
        this.attack = attack * 0.4;
        this.release = release * 1.5;
        
        if (this.release < 0) {
            this.release = 0.1; // 0 - release causes mute for some reason
        }
        this.spread = spread;
        
        this.randomoffset = (Math.random() * this.spread) - (this.spread / 2); // in seconds
        // envelope
        this.source.start(this.now, Math.max(0, this.offset + this.randomoffset), this.attack + this.release); // parameters (when, offset, duration)
        this.gain.gain.setValueAtTime(0.0, this.now);
        this.gain.gain.linearRampToValueAtTime(this.amp, this.now + this.attack);
        this.gain.gain.linearRampToValueAtTime(0, this.now + (this.attack + this.release));
        
        // garbage collection
        this.source.stop(this.now + this.attack + this.release + 0.1);
        const tms = (this.attack + this.release) * 1000; // calculate the time in milliseconds
        setTimeout(() => {
            this.gain.disconnect();
            if (yes === 1) {
                this.panner.disconnect();
            }
        }, tms + 200);
        
        // drawing the lines
        p.stroke(p.random(125) + 125, p.random(250), p.random(250)); // ,(this.amp + 0.8) * 255
        this.randomoffsetinpixels = this.randomoffset / (buffer.duration / w);
        p.line(this.positionx + this.randomoffsetinpixels, 0, this.positionx + this.randomoffsetinpixels, p.height);
        setTimeout(() => {
            p.background();
            p.line(this.positionx + this.randomoffsetinpixels, 0, this.positionx + this.randomoffsetinpixels, p.height);
        }, 200);
    }

    // Function to calculate playback rate for a given number of semitones
    semitoneToPlaybackRate(semitones) {
        return Math.pow(2, semitones / 12);
    }

    // Function to map input range (-1.0 to 1.0) to semitones (-12 to 12)
    mapInputToSemitones(input) {
        return Math.round(input * 12); // Map and round to the nearest semitone
    }

    // Function to map input range (-1.0 to 1.0) to the minor pentatonic scale
    mapInputToMinorPentatonic(input) {
        // Map input to an index in the minor pentatonic intervals array
        const scaledInput = (input + 1) / 2; // Scale input to the range [0, 1]
        const quantizedPitchArrayLength = minorPentatonicIntervals.length - 1;
        const index = Math.round(scaledInput * quantizedPitchArrayLength);
        const interval = minorPentatonicIntervals[index]
        console.log(input, scaledInput, quantizedPitchArrayLength, index, interval)
        return interval;
    };    
}

// the Voice class
/**
 * Represents a voice that can play grains.
 * @class
 */
class Voice {
	/**
	 * Creates a new instance of the Voice class.
	 * @constructor
	 * @param {number} id - The id of the touch event.
	 */
	constructor(id) {
		this.touchid = id; // the id of the touch event
	}

	/**
	 * Plays grains based on mouse position.
	 * @param {p5} p - The p5 instance.
	 */
	playmouse(p) {
		this.grains = [];
		this.grainscount = 0;
		const play = () => {
			// create new grain
			const g = new Grain(p, buffer, p.mouseX, p.mouseY, attack, release, spread, pan);
			// push to the array
			this.grains[this.graincount] = g;
			this.graincount += 1;
			
			if (this.graincount > 20) {
				this.graincount = 0;
			}
			// next interval
			this.dens = p.map(density, 1, 0, 0, 1);
			this.interval = (this.dens * 500) + 70;
			this.timeout = setTimeout(play, this.interval);
		};
		play();
	}

	/**
	 * Plays grains based on touch position.
	 * @param {p5} p - The p5 instance.
	 * @param {number} positionx - The x position of the touch event.
	 * @param {number} positiony - The y position of the touch event.
	 */
	playtouch(p, positionx, positiony) {
		this.positionx = positionx;
		this.positiony = positiony;
		this.grains = [];
		this.graincount = 0;
		const play = () => {
			// create new grain
			const g = new Grain(p, buffer, this.positionx, this.positiony, attack, release, spread, pan);
			// push to the array
			this.grains[this.graincount] = g;
			this.graincount += 1;
			
			if (this.graincount > 30) {
				this.graincount = 0;
			}
			// next interval
			this.dens = p.map(density, 1, 0, 0, 1);
			this.interval = (this.dens * 500) + 70;
			this.timeout = setTimeout(play, this.interval);
		};
		play();
	}

	/**
	 * Stops playing the grains.
	 */
	stop() {
		clearTimeout(this.timeout);
	}
}

class Sample {
    constructor(buffer, loop = false, playbackRate = 1.0, reverse = false) {
        console.log("Sample " + buffer);
        this.context = context; // Assuming 'context' is the AudioContext instance you have elsewhere
        if (reverse && buffer) {
            this.buffer = this.reverseBuffer(buffer);
        } else {
            this.buffer = buffer;
        }
        this.master = master; // Assuming 'master' is an AudioNode you have elsewhere
        this.source = null; // Initialize source as null
        this.loop = loop; // Store loop option
        this.playbackRate = playbackRate; // Store playbackRate option
    }

    createSource() {
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = this.loop; // Apply loop setting
        this.source.playbackRate.value = this.playbackRate; // Apply playbackRate setting
        this.source.connect(this.master);
    }

    play() {
        this.createSource(); // Create a new source node
        this.source.start(0); // Start at the beginning for normal playback
    }

    stop() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect(); // Disconnect from the master node
            this.source = null; // Dispose of the source node
        }
    }

    toggleLoop(_loop) {
        this.loop = _loop;
        if (this.source) {
            this.source.loop = this.loop;
        }
    }

    reverseBuffer(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const newBuffer = context.createBuffer(numberOfChannels, length, sampleRate);
        
        for (let i = 0; i < numberOfChannels; i++) {
            const channel = audioBuffer.getChannelData(i);
            const newChannel = newBuffer.getChannelData(i);
            
            for (let j = 0, k = length - 1; j < length; j++, k--) {
                newChannel[j] = channel[k];
            }
        }
        
        return newBuffer;
    }

    getCurrentPlayheadPosition() {
        if (!this.source) return 0; // If nothing is playing, return 0

        const elapsedTime = this.context.currentTime - this.startTime;
        const bufferDuration = this.source.buffer.duration / this.playbackRate;
        const currentPlayheadPosition = (elapsedTime % bufferDuration) * this.playbackRate;

        return currentPlayheadPosition;
    }
}

// processing - waveform display - canvas 
const waveformdisplay = (p) => {
    w = parseInt($('#waveform').css('width'), 10); // get the width
    h = parseInt($('#waveform').css('height'), 10); // get the height

    // draw the buffer
    const drawBuffer = () => {
        const step = Math.ceil(data.length / w);
        const amp = h / 2;
        
        p.background(0);
        for (let i = 0; i < w; i++) {
            let min = 1.0;
            let max = -1.0;
         
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) {
                    min = datum;
                } else if (datum > max) {
                    max = datum;
                }
            }
            p.rect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    };

    const drawPitchQuantizeOverlay = () => {
        if (pitchQuantizeMode === QuantizeMode.MINOR_PENTATONIC) {
            const intervalHeight = h / (minorPentatonicIntervals.length -1);
            for (let i = 0; i < minorPentatonicIntervals.length; i++) {
                const y = i * intervalHeight;
                p.fill(0, 0, 255, 40);
                p.rect(0, y, w, intervalHeight);
            }
        }
    };

    p.setup = () => {
        p.size(w, h);
        p.background(0); // background black
        // change the size on resize
        $(window).resize(() => {
            w = parseInt($('#waveform').css('width'), 10);
            h = parseInt($('#waveform').css('height'), 10);
            p.size(w, h);
            // redraw buffer on resize
            p.stroke(255);
            drawBuffer();
            drawPitchQuantizeOverlay();
        });
        p.strokeWeight(0.01);
        p.stroke(255);
        drawBuffer();
        drawPitchQuantizeOverlay();
        p.noLoop();
    };
};

// processing - grain display and main interaction system
const grainsdisplay = (p) => {
    w = parseInt($('#waveform').css('width'), 10);
    h = parseInt($('#waveform').css('height'), 10);

    // setup
    p.setup = () => {
        p.size(w, h);
        p.background(0, 0); // background black alpha 0
        p.frameRate(24);
        p.noLoop();
        
        // change the size on resize
        $(window).resize(() => {
            w = parseInt($('#waveform').css('width'), 10);
            h = parseInt($('#waveform').css('height'), 10);
            p.size(w, h);
        });
    };

    // mouse events
    $('#canvas2').mousedown(() => {
        mouseState = true;
        
        if (mouseState) {
            const v = new Voice();
            v.playmouse(p);
            voicesmono[0] = v; // have in the array
        }
    }).mouseup(() => {
        mouseState = false;
        for (let i = 0; i < voicesmono.length; i++) {
            voicesmono[i].stop();
            voicesmono.splice(i, 1);
        }
        setTimeout(() => {
            p.background();
        }, 300);
    }).mousemove(() => {
        X = p.mouseX;
        Y = p.mouseY;
    });

    // safety for when the mouse is out of the canvas
    $(document).mousemove((e) => {
        if (e.target.id !== 'canvas2') {
            for (let i = 0; i < voicesmono.length; i++) {
                voicesmono[i].stop();
                voicesmono.splice(i, 1);
                setTimeout(() => {
                    p.background();
                }, 300);
            }
        }
    });

    // touch events
    const canvas2 = document.getElementById('canvas2');
    canvas2.addEventListener('touchstart', (event) => {
        event.preventDefault(); // to prevent scrolling      
        for (let i = 0; i < Math.min(maxTouches, event.touches.length); i++) {
            const touch = event.touches[i];
            if (touch.target.id === 'canvas2') {
                const id = touch.identifier; // the id will be used for voice stop
                const v = new Voice(id);
                const clientX = touch.clientX;
                const clientY = touch.clientY;
                
                // multitouch optimization
                let interval;
                // calculate the reverse interval
                if (event.touches.length > 1) {
                    interval = p.map(density, 0, 1, 1, 0.7);
                } else {
                    interval = p.map(density, 0, 1, 1, 0);
                }
                
                // play
                v.playtouch(p, clientX, clientY, interval);
                voices.push(v);
            }
        }
    });

    canvas2.addEventListener('touchend', (event) => {
        for (const voice of voices) {
            for (const touch of event.changedTouches) {
                if (voice.touchid === touch.identifier) {
                    voice.stop();
                }
            }
        }
        
        // safety and garbage collection
        if (event.touches.length < 1) {
            for (const voice of voices) {
                voice.stop();
            }
            voices.length = 0;
            setTimeout(() => {
                p.background();
            }, 200);
        }
    });

    canvas2.addEventListener('touchmove', (event) => {
        event.preventDefault();
        
        for (const voice of voices) {
            for (const touch of event.changedTouches) {
                if (voice.touchid === touch.identifier) {
                    if (touch.clientY < h + 50) {
                        voice.positiony = touch.clientY;
                        voice.positionx = touch.clientX;
                    } else {
                        voice.stop();
                    }
                }
            }
        }
    });
};



// onload
$(document).ready(() => {
    window.history.pushState(null, null, '');
    // grain display init
    const canvas2 = document.getElementById('canvas2');
    const processing = new Processing(canvas2, grainsdisplay);

    document.addEventListener("touchmove", (e) => {
        e.preventDefault();
    });
    // gui
    guiinit();

    $('#play').button().click(function() {
        console.log("Play");
        if (globalSample) {
            globalSample.stop();
        } 
        globalSample = new Sample(buffer, $('#loop').prop('checked'), 1.0 + tuning);
        globalSample.play();
    });

    $('#reversePlay').button().click(function () {
        console.log("Reverse play");
        if (globalSample) {
            globalSample.stop();
        } 
        globalSample = new Sample(buffer, $('#loop').prop('checked'), 1.0 + tuning, true);
        globalSample.play();
    });    

    $('#stop').button().click(function () {
        console.log("Stop");
        if (globalSample) {
            globalSample.stop();
        }
    });

    $('#loop').button().change(function () {
        console.log("Loop: " + $(this).prop('checked'));
        if (globalSample) {
            globalSample.toggleLoop($(this).prop('checked'));
        }
    });

    $('#reset').button().click(function () {
        window.location.reload();
    });

});
