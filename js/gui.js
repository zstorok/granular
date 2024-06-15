function guiinit() {
    const dialwidth = parseInt($('.col-sm-2').css('width')) - (parseInt($('.col-sm-2').css('width')) / 6);

    const settings = {
        min: 0,
        max: 20,
        width: dialwidth,
        displayInput: true,
        angleArc: 180,
        angleOffset: -90
    };

    const bg = '#E4E4E4';
    const fg = '#2a6496';

    $("#attack").knob({
        ...settings,
        val: knobValues.attack,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            attack = v / 100;
            console.log("Attack: " + attack);
        }
    });

    $("#release").knob({
        ...settings,
        val: knobValues.release,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            release = v / 100;
            console.log("Release: " + release);
        }
    });

    $('#density').knob({
        ...settings,
        max: 110,
        val: knobValues.density,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            density = v / 100;
            console.log("Density: " + density);
        }
    });

    $('#spread').knob({
        ...settings,
        max: 200,
        val: knobValues.spread,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            spread = v / 100;
            console.log("Spread: " + spread);
        }
    });

    $('#pan').knob({
        ...settings,
        max: 200,
        val: knobValues.pan,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            pan = v / 100;
            console.log("Pan: " + pan);
        }
    });

    $('#tuning').knob({
        ...settings,
        min: -1000,
        max: 500,
        val: knobValues.tuning,
        bgColor: bg,
        fgColor: fg,
        change: (v) => {
            tuning = v / 1000;
            console.log("Tuning: " + tuning);
            if (globalSample) {
                globalSample.source.playbackRate.value = 1.0 + tuning;
            }
        }
    });

    $('input[name="pitchQuantizeMode"][value="' + pitchQuantizeMode + '"]').prop('checked', true);

    $('input[name="pitchQuantizeMode"]').change(function () {
        var mode = $(this).val();
        console.log("Pitch Quantize Mode: " + mode);
        // handle the new mode here
        for (var enumMode in QuantizeMode) {
            if (QuantizeMode.hasOwnProperty(enumMode) && QuantizeMode[enumMode] == mode) {
                pitchQuantizeMode = mode;
            }
        }
    });

    const load = () => {
        $('#canvas').show();
        $('#canvas2').show();

        $('#canvas').animate({
            opacity: 1
        }, 1000);

        $('#canvas2').animate({
            opacity: 1
        }, 1000);

        $('#help').animate({
            opacity: 0
        }, 1000, () => {
            $('#help').hide();
            helpvisible = false;
        });
    };

    $('#canvas2').hide();
    $('#canvas').hide();
    $('#helpbutton').click(() => {
        if (helpvisible) {
            load();
            helpvisible = false;
        } else {
            $('#canvas2').animate({
                opacity: 0.1
            }, 1000, () => {
                $('#help').css('opacity', 0);
                $('#canvas2').hide();
                $('#help').animate({
                    opacity: 1
                }, 1000);
                $('#help').show();
            });

            $('#canvas').animate({
                opacity: 0.0
            }, 1000, () => {
                $('#help').show();
                $('#canvas').hide();
            });

            helpvisible = true;
        }
    });

    $('.sample').hover(
        function () {
            $(this).css('opacity', '0.5');
        },
        function () {
            $(this).css('opacity', '1');
        }
    );

    $('#sample1').click(() => {
        load();
    });

    $('#sample2').click(() => {
        const request = new XMLHttpRequest();
        request.open('GET', 'audio/synth.mp3', true);
        request.responseType = "arraybuffer";
        request.onload = () => {
            context.decodeAudioData(request.response, (b) => {
                buffer = b; // set the buffer
                data = buffer.getChannelData(0);
                isloaded = true;
                const canvas1 = document.getElementById('canvas');
                const processing = new Processing(canvas1, waveformdisplay);
                load();
            }, () => {
                console.log('loading failed');
                alert('loading failed');
            });
        };
        request.send();
    });

    const drop = document.getElementById('waveform');
    drop.addEventListener("dragover", (e) => {
        e.preventDefault();
    }, false);
    drop.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const array = e.target.result;
            context.decodeAudioData(array, (b) => {
                buffer = b;
                data = buffer.getChannelData(0);
                const canvas1 = document.getElementById('canvas');
                const processing = new Processing(canvas1, waveformdisplay);
                load();
            }, () => {
                console.log('loading failed');
                alert('loading failed');
            });
        };
        reader.readAsArrayBuffer(file);
    }, false);
}
