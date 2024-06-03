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

/**
 * Represents a grain.
 * @class
 */
class Grain {
    constructor(p, buffer, positionx, positiony, attack, release, spread, pan) {
        console.log(p, buffer, positionx, positiony, attack, release, spread, pan);
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
        this.positiony = positiony;
        const scaledPositionY = p.map(this.positiony / h, 0.0, 1.0, 1.0, -1.0);

        const semitones = this.mapInputToSemitones(scaledPositionY);
        const quantizedPlaybackRate = this.semitoneToPlaybackRate(semitones);
        console.log(quantizedPlaybackRate);
        this.source.playbackRate.value = quantizedPlaybackRate
        
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

// loading the first sound with XMLHttpRequest
const request = new XMLHttpRequest();
request.open('GET', 'audio/guitar.mp3', true);
request.responseType = "arraybuffer";
request.onload = () => {
    context.decodeAudioData(request.response, (b) => {
        buffer = b; // set the buffer
        data = buffer.getChannelData(0);
        isloaded = true;
        const canvas1 = document.getElementById('canvas');
        // initialize the processing draw when the buffer is ready
        const processing = new Processing(canvas1, waveformdisplay);
    }, () => {
        console.log('loading failed');
    });
};
request.send();

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
        });
        p.strokeWeight(0.01);
        p.stroke(255);
        drawBuffer();
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
        
        // 4 touches glitches on iPad
        if (event.touches.length < 4) {
            for (const touch of event.touches) {
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
});
