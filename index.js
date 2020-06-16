const PulseAudio = require('@johnf/pulseaudio2');
const context = new PulseAudio();

let xMin = 0;
let xMax = 1;
let amplitude8bit = 0;

context.source().then((list) => {
  const stream = context.createRecordStream({
    channels: 1 // Simplify amplitude calculations, no need for left/right/etc
  });

  stream.on('state', (state) => {
    if (state !== 'ready') { return; }
    stream.on('data', (chunk) => {

      // Feature scaling, rescaling/min-max scaling
      for (let i = 0; i < chunk.length; i += 2) {
        const amplitude = chunk.readInt16LE(i);
        xMax = Math.max(amplitude, xMax);
        xMin = Math.min(amplitude, xMin);
        const amplitudeRescaled = (amplitude - xMin) / (xMax - xMin);

        // Subtract 255 / 2 since we care about loud noises
        amplitude8bit = parseInt((amplitudeRescaled * 255));
      }
    });
  });
});

setInterval(() => {
  console.log(amplitude8bit);
}, 1000/24);
