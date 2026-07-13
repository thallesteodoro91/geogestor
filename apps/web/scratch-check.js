import * as phosphor from '@phosphor-icons/react';
console.log("Stopwatch exists:", !!phosphor.Stopwatch);
console.log("Timer exists:", !!phosphor.Timer);
console.log("Handshake exists:", !!phosphor.Handshake);
console.log("Agreement exists:", !!phosphor.Agreement);
console.log("Keys containing Stop:", Object.keys(phosphor).filter(k => k.toLowerCase().includes('stop')));
console.log("Keys containing Agree:", Object.keys(phosphor).filter(k => k.toLowerCase().includes('agree')));
