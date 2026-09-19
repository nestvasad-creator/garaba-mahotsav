import fs from 'fs';

// Let's inspect Capture.JPG size and details
const stat = fs.statSync('Capture.JPG');
console.log('Capture.JPG size:', stat.size);
