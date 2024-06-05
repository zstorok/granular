var knobValues = {
    attack: 10,
    release: 10,
    density: 105,
    spread: 0,
    pan: 0
};

var positionYPitch = true;
var maxTouches = 4;

const QuantizeMode = Object.freeze({
    NONE: "None",
    CHROMATIC: "Chromatic",
    MINOR_PENTATONIC: "Minor Pentatonic",
});

var pitchQuantizeMode = QuantizeMode.MINOR_PENTATONIC;