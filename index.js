const fft = require('jsfft');
const noble = require('@abandonware/noble');
const PulseAudio = require('@johnf/pulseaudio2');
const context = new PulseAudio();

const PLAYBULB_SPHERE_SERVICE = 'ff0f'; //'0000ff0f-0000-1000-8000-00805f9b34fb';
const PLAYBULB_SET_MODE_WRITE = 'fffb'; //'0000fffb-0000-1000-8000-00805f9b34fb';
const PLAYBULB_SET_COLOR_WRITE = 'fffc'; //'0000fffc-0000-1000-8000-00805f9b34fb';

const Mode = {
  Blink: 0,
  Pulse: 1,
  RainbowFade: 2,
  RainbowPulse: 3,
  Candle: 4,
  Solid: 5
};

const SOLID_MODE = Buffer.from([0x00, 0x00, 0x00, 0x00, Mode.Solid, 0x00, 0x00, 0x00]);

let xMin = 0;
let xMax = 1;
let amplitude = 0;
let amplitude8bit = 0;
let lastAmplitude8bit = 0;

let frequencies;
let amplitudes = [];

const colorBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

const sampleRate = 8000;

context.source().then((list) => {
  const stream = context.createRecordStream({
    channels: 1, // Simplify amplitude calculations, no need for left/right/etc
    rate: sampleRate
  });

  stream.on('state', (state) => {
    if (state !== 'ready') { return; }
    
    //console.log('Connected to audio source');
    stream.on('data', (chunk) => {

      // Feature scaling, rescaling/min-max scaling
      for (let i = 0; i < chunk.length; i += 2) {
        amplitude = chunk.readInt16LE(i);
        xMax = Math.max(amplitude, xMax);
        xMin = Math.min(amplitude, xMin);
        const amplitudeRescaled = (amplitude - xMin) / (xMax - xMin);
        amplitudes.push(amplitudeRescaled);

        lastAmplitude8bit = amplitude8bit;
        amplitude8bit = amplitudeRescaled;
      }

      if (amplitudes.length > parseInt(sampleRate / 10)) {
        frequencies = (new fft.ComplexArray(amplitudes.length).map((v, i, n) => { v.real = amplitudes[i]; })).FFT();
        amplitudes.length = 0;
      }

    });
  });
});

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    //console.log('Connected to Bluetooth adapter');
    noble.startScanningAsync([PLAYBULB_SPHERE_SERVICE], false);
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', async (peripheral) => {
  await noble.stopScanningAsync();
  await peripheral.connectAsync();

  //console.log('Connected to Bluetooth peripheral');

  const { characteristics } = await peripheral
    .discoverSomeServicesAndCharacteristicsAsync([PLAYBULB_SPHERE_SERVICE], [
      PLAYBULB_SET_MODE_WRITE,
      PLAYBULB_SET_COLOR_WRITE
    ]);

  //console.log('Setting sphere to dark...');
  // characteristics[0].write(SOLID_MODE, true);

  //console.log('Time to get this party started!');


  setInterval(() => {
    if (lastAmplitude8bit === amplitude8bit) { return; }

    console.log(frequencies);

    const freqsRescaled = frequencies.real.map((f) => {
      xMax2 = Math.max(f, xMax2);
      xMin2 = Math.min(f, xMin2);
      return (f - xMin2) / (xMax2 - xMin2);
    });

/*
    largestFrequency = freqsRescaled.reduce((f, c) => Math.max(f, c), 0);
    scaledFrequency = Math.min(1, Math.max(0, largestFrequency));
    colorBuffer.writeUInt8(parseInt(scaledFrequency * 255.0), 1);

    largestFrequency = frequencyBins[1].reduce((f, c) => Math.max(f, c), 0);
    scaledFrequency = Math.min(1, Math.max(0, (largestFrequency - 0.3) * 1.46));
    colorBuffer.writeUInt8(parseInt(scaledFrequency * 255.0), 2);

    largestFrequency = frequencyBins[2].reduce((f, c) => Math.max(f, c), 0);
    scaledFrequency = Math.min(1, Math.max(0, (largestFrequency - 0.3) * 1.06));
    colorBuffer.writeUInt8(parseInt(scaledFrequency * 255.0), 3);
    */

    characteristics[1].write(colorBuffer, true);
  }, 1000/30);
});

var largestFrequency, scaledFrequency, xMax2 = 0, xMin2 = 0;
